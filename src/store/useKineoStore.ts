import { create } from 'zustand';
import type { EquivalenceClass, KineoDocument } from '../types/kineo';
import { changeShape, resizeGeometry } from '../model/graphics';
import type { ShapeKind } from '../model/graphics';
import { referenceBody } from '../model/nomenclature';
import type { DisplaySettings, GeometryEntity, GroundFixation, Liaison, Vector3 } from '../model/jsonV3';
import { createDefaultDocument, JOINT_DEFINITIONS } from '../model/defaultDocument';
import { validateReferences } from '../model/conversion';
import { validateKineoV3 } from '../model/validation';

type SelectionType = 'Class' | 'Joint' | 'Geometry' | 'Fixation';
type ViewMode = '2D' | '3D' | 'Graph' | 'Split';

interface KineoState {
  document: KineoDocument;
  activeViewMode: ViewMode;
  activeAppMode: 'Edit' | 'Simulation' | 'Nomenclature';
  selectedEntityId: string | null;
  selectedEntityType: SelectionType | null;
  documentRevision: number;
  savedDocumentJson: string;
  gridVisible: boolean;
  snapEnabled: boolean;
  undoStack: KineoDocument[];
  redoStack: KineoDocument[];
  setViewMode: (mode: ViewMode) => void;
  setAppMode: (mode: 'Edit' | 'Simulation' | 'Nomenclature') => void;
  selectEntity: (id: string | null, type: SelectionType | null) => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  addGround: () => string;
  fixBody: (bodyId: string, position: Vector3, angle: number, orientationMode?: GroundFixation['orientationMode']) => string;
  updateFixation: (id: string, patch: Partial<Pick<GroundFixation, 'localPoint' | 'angle' | 'orientationMode'>>, history?: boolean) => void;
  setBodyShape: (bodyId: string, kind: ShapeKind, entityId?: string) => void;
  updateGeometry: (id: string, updates: Partial<Pick<GeometryEntity, 'kind' | 'localPoints' | 'style' | 'cornerRadius'>>, history?: boolean) => void;
  resizeShape: (id: string, width: number, height: number, history?: boolean) => void;
  setDisplay: (patch: Partial<DisplaySettings>) => void;
  setGround: (id: string) => void;
  addClass: (name: string, position: Vector3) => string;
  updateClass: (id: string, updates: Partial<Pick<EquivalenceClass, 'name' | 'color' | 'position' | 'rotation'>>) => void;
  beginEdit: () => void;
  moveClass: (id: string, position: Vector3) => void;
  moveJoint: (id: string, position: Vector3) => void;
  updateJointAnchor: (id: string, frame: 'onClassA' | 'onClassB', anchor: Vector3) => void;
  addJoint: (type: string, classA: string, classB: string, position: Vector3, angle?: number) => string;
  updateJoint: (id: string, updates: Partial<Pick<Liaison, 'name' | 'type' | 'classA' | 'classB' | 'position' | 'dof' | 'orientation' | 'referenceAngle'>>) => void;
  removeEntity: (id: string, type: SelectionType) => void;
  replaceDocument: (document: unknown) => void;
  markDocumentSaved: () => void;
  setTitle: (title: string) => void;
  undo: () => void;
  redo: () => void;
}

const initialDocument = createDefaultDocument();
const initialSavedDocumentJson = JSON.stringify(initialDocument);

function commitDocument(state: KineoState, document: KineoDocument): Partial<KineoState> {
  return {
    document,
    undoStack: [...state.undoStack.slice(-99), state.document],
    redoStack: [],
  };
}

function newId(prefix: string): string {
  return `${prefix}_${globalThis.crypto.randomUUID()}`;
}

function validateDocument(document: KineoDocument): void {
  validateKineoV3(document);
  validateReferences(document);
}

function localPointForBody(world: Vector3, body: EquivalenceClass): Vector3 {
  const position = body.position ?? { x: 0, y: 0, z: 0 };
  const angle = body.rotation ?? 0;
  const dx = world.x - position.x;
  const dy = world.y - position.y;
  return {
    x: dx * Math.cos(angle) + dy * Math.sin(angle),
    y: -dx * Math.sin(angle) + dy * Math.cos(angle),
    z: world.z - position.z,
  };
}

function worldPointForBody(local: Vector3, body: EquivalenceClass): Vector3 {
  const position = body.position ?? { x: 0, y: 0, z: 0 };
  const angle = body.rotation ?? 0;
  return {
    x: position.x + local.x * Math.cos(angle) - local.y * Math.sin(angle),
    y: position.y + local.x * Math.sin(angle) + local.y * Math.cos(angle),
    z: position.z + local.z,
  };
}

function selectionExists(document: KineoDocument, id: string | null, type: SelectionType | null): boolean {
  if (!id || !type) return false;
  if (type === 'Fixation') return document.classesEquivalence.some((body) => body.groundFixation?.id === id);
  if (type === 'Class') return document.classesEquivalence.some((item) => item.id === id);
  if (type === 'Joint') return document.liaisons.some((item) => item.id === id);
  return document.geometry.entities.some((item) => item.id === id);
}

function updateClassDocument(
  current: KineoDocument,
  id: string,
  updates: Partial<Pick<EquivalenceClass, 'name' | 'color' | 'position' | 'rotation'>>,
): KineoDocument {
  const body = current.classesEquivalence.find((item) => item.id === id);
  if (!body) return current;
  const oldPosition = body.position ?? { x: 0, y: 0, z: 0 };
  const newPosition = updates.position ?? oldPosition;
  const oldRotation = body.rotation ?? 0;
  const newRotation = updates.rotation ?? oldRotation;
  const transformAnchor = (anchor: Vector3, position: Vector3, angle: number): Vector3 => ({
    x: position.x + anchor.x * Math.cos(angle) - anchor.y * Math.sin(angle),
    y: position.y + anchor.x * Math.sin(angle) + anchor.y * Math.cos(angle),
    z: position.z + anchor.z,
  });

  return {
    ...current,
    classesEquivalence: current.classesEquivalence.map((item) =>
      item.id === id ? { ...item, ...updates } : item,
    ),
    liaisons: current.liaisons.map((joint) => {
      const anchor = joint.classA === id
        ? joint.anchors.onClassA
        : joint.classB === id
          ? joint.anchors.onClassB
          : null;
      if (!anchor) return joint;
      const previous = transformAnchor(anchor, oldPosition, oldRotation);
      const next = transformAnchor(anchor, newPosition, newRotation);
      return {
        ...joint,
        position: {
          ...joint.position,
          x: joint.position.x + next.x - previous.x,
          y: joint.position.y + next.y - previous.y,
          z: joint.position.z + next.z - previous.z,
        },
      };
    }),
    geometry: {
      ...current.geometry,
      entities: current.geometry.entities.map((entity) =>
        entity.classId === id && updates.color
          ? { ...entity, style: { ...entity.style, color: updates.color } }
          : entity,
      ),
    },
  };
}

export const useKineoStore = create<KineoState>((set, get) => ({
  document: initialDocument,
  activeViewMode: '2D',
  activeAppMode: 'Edit',
  selectedEntityId: null,
  selectedEntityType: null,
  documentRevision: 0,
  savedDocumentJson: initialSavedDocumentJson,
  gridVisible: true,
  snapEnabled: true,
  undoStack: [],
  redoStack: [],

  setViewMode: (activeViewMode) => set({ activeViewMode }),
  setAppMode: (activeAppMode) => set({ activeAppMode }),
  selectEntity: (selectedEntityId, selectedEntityType) => set({ selectedEntityId, selectedEntityType }),
  toggleGrid: () => set((state) => ({ gridVisible: !state.gridVisible })),
  toggleSnap: () => set((state) => ({ snapEnabled: !state.snapEnabled })),

  fixBody: (bodyId, position, angle, orientationMode = 'manual') => {
    const body = get().document.classesEquivalence.find((b) => b.id === bodyId);
    if (!body || !Number.isFinite(angle)) throw new Error('Sélectionnez un solide existant et une orientation valide.');
    const id = body.groundFixation?.id ?? newId('fixation');
    set((state) => {
      const document = { ...state.document, classesEquivalence: state.document.classesEquivalence.map((b) => b.id !== bodyId ? b : {
        ...b, isFixed: true, groundFixation: {
          id, type: 'GROUND_FIXATION' as const, localPoint: localPointForBody(position, b),
          angle: angle - (b.rotation ?? 0), wasFixed: b.groundFixation?.wasFixed ?? b.isFixed,
          orientationMode,
        },
      }) };
      validateDocument(document);
      return { ...commitDocument(state, document), selectedEntityId: id, selectedEntityType: 'Fixation' as const };
    });
    return id;
  },
  updateFixation: (id, patch, history = true) => set((state) => {
    if (!state.document.classesEquivalence.some((b) => b.groundFixation?.id === id)) throw new Error('Fixation introuvable.');
    const document = { ...state.document, classesEquivalence: state.document.classesEquivalence.map((b) => b.groundFixation?.id === id
      ? { ...b, groundFixation: { ...b.groundFixation, ...patch } } : b) };
    validateDocument(document);
    return history ? commitDocument(state, document) : { document };
  }),
  setBodyShape: (bodyId, kind, entityId) => {
    const state = get(), body = state.document.classesEquivalence.find((b) => b.id === bodyId);
    if (!body) throw new Error('Solide introuvable.');
    const entity = state.document.geometry.entities.find((g) => entityId ? g.id === entityId && g.classId === bodyId : g.classId === bodyId);
    if (entity) get().updateGeometry(entity.id, changeShape(entity, kind));
    else set((current) => commitDocument(current, { ...current.document, geometry: { ...current.document.geometry, entities: [...current.document.geometry.entities,
      changeShape({ id: newId('ent'), classId: bodyId, kind: 'segment', localPoints: [{ x: 0, y: 0, z: 0 }, { x: 60, y: 0, z: 0 }], style: { stroke: 'solid', width: 2, color: body.color }, view: '2D' }, kind),
    ] } }));
  },
  updateGeometry: (id, updates, history = true) => set((state) => {
    if (!state.document.geometry.entities.some((g) => g.id === id)) throw new Error('Géométrie introuvable.');
    const document = { ...state.document, geometry: { ...state.document.geometry, entities: state.document.geometry.entities.map((g) => g.id === id ? { ...g, ...updates } : g) } };
    validateDocument(document);
    return history ? commitDocument(state, document) : { document };
  }),
  resizeShape: (id, width, height, history = true) => {
    const entity = get().document.geometry.entities.find((g) => g.id === id);
    if (!entity) throw new Error('Géométrie introuvable.');
    get().updateGeometry(id, { localPoints: resizeGeometry(entity, width, height).localPoints }, history);
  },
  setDisplay: (patch) => set((state) => commitDocument(state, { ...state.document, geometry: {
    ...state.document.geometry, display: { bodyIds: true, jointIds: true, anchors: false, ...state.document.geometry.display, ...patch },
  } })),

  addGround: () => {
    const existing = get().document.classesEquivalence.find((body) => body.isFixed);
    if (existing) return existing.id;
    const id = newId('ground');
    set((state) => ({
      ...commitDocument(state, {
        ...state.document,
        classesEquivalence: [...state.document.classesEquivalence, {
          id, name: 'Bâti', color: '#64748b', isFixed: true, parentId: null,
          position: { x: 0, y: 0, z: 0 }, rotation: 0,
        }],
      }),
      selectedEntityId: id, selectedEntityType: 'Class',
    }));
    return id;
  },
  setGround: (id) => set((state) => {
    if (!state.document.classesEquivalence.some((body) => body.id === id)) throw new Error('Solide introuvable');
    return commitDocument(state, {
      ...state.document,
      meta: { ...state.document.meta, groundBodyId: id },
      classesEquivalence: state.document.classesEquivalence.map((body) => ({ ...body, isFixed: body.id === id || !!body.groundFixation,
        ...(body.groundFixation ? { groundFixation: { ...body.groundFixation, wasFixed: body.id === id } } : {}),
      })),
    });
  }),

  addClass: (name, position) => {
    const id = newId('eq');
    set((state) => {
      const palette = ['#e63946', '#2a9d8f', '#457b9d', '#f4a261', '#9b5de5'];
      const index = Math.max(0, state.document.classesEquivalence.length - 1);
      const body: EquivalenceClass = {
        id,
        name,
        color: palette[index % palette.length],
        isFixed: false,
        parentId: null,
        position,
        rotation: 0,
      };
      const document: KineoDocument = {
        ...state.document,
        classesEquivalence: [...state.document.classesEquivalence, body],
        geometry: {
          ...state.document.geometry,
          entities: [
            ...state.document.geometry.entities,
            {
              id: newId('ent'),
              kind: 'segment',
              classId: id,
              localPoints: [{ x: 0, y: 0, z: 0 }, { x: 60, y: 0, z: 0 }],
              style: { stroke: 'solid', width: 4, color: body.color },
              view: '2D',
            },
          ],
        },
      };
      validateDocument(document);
      return {
        ...commitDocument(state, document),
        selectedEntityId: id,
        selectedEntityType: 'Class',
      };
    });
    return id;
  },

  updateClass: (id, updates) => set((state) => {
    const body = state.document.classesEquivalence.find((item) => item.id === id);
    if (!body) throw new Error(`Unknown class ${id}`);
    const positionChanged = updates.position !== undefined &&
      (updates.position.x !== (body.position?.x ?? 0) ||
       updates.position.y !== (body.position?.y ?? 0) ||
       updates.position.z !== (body.position?.z ?? 0));
    const rotationChanged = updates.rotation !== undefined && updates.rotation !== (body.rotation ?? 0);
    if (body.isFixed && (positionChanged || rotationChanged)) {
      throw new Error('The ground body reference frame cannot be moved');
    }
    const document = updateClassDocument(state.document, id, updates);
    validateDocument(document);
    return commitDocument(state, document);
  }),
  beginEdit: () => set((state) => ({
    undoStack: [...state.undoStack.slice(-99), state.document],
    redoStack: [],
  })),
  moveClass: (id, position) => set((state) => {
    const body = state.document.classesEquivalence.find((item) => item.id === id);
    if (!body) throw new Error(`Unknown class ${id}`);
    if (body.isFixed) return state;
    const document = updateClassDocument(state.document, id, { position });
    validateDocument(document);
    return { document };
  }),
  moveJoint: (id, position) => set((state) => {
    if (!state.document.liaisons.some((joint) => joint.id === id)) {
      throw new Error(`Unknown joint ${id}`);
    }
    const document = {
      ...state.document,
      liaisons: state.document.liaisons.map((joint) => {
        if (joint.id !== id) return joint;
        const bodyA = state.document.classesEquivalence.find((body) => body.id === joint.classA);
        const bodyB = state.document.classesEquivalence.find((body) => body.id === joint.classB);
        if (!bodyA || !bodyB) return joint;
        return {
          ...joint,
          position,
          anchors: {
            ...joint.anchors,
            onClassA: localPointForBody(position, bodyA),
            onClassB: localPointForBody(position, bodyB),
          },
        };
      }),
    };
    validateDocument(document);
    return { document };
  }),
  updateJointAnchor: (id, frame, anchor) => set((state) => {
    const joint = state.document.liaisons.find((item) => item.id === id);
    if (!joint) throw new Error(`Unknown joint ${id}`);
    const bodyA = state.document.classesEquivalence.find((body) => body.id === joint.classA);
    const bodyB = state.document.classesEquivalence.find((body) => body.id === joint.classB);
    if (!bodyA || !bodyB) throw new Error(`Joint ${id} references a missing body`);
    const position = worldPointForBody(anchor, frame === 'onClassA' ? bodyA : bodyB);
    const document: KineoDocument = {
      ...state.document,
      liaisons: state.document.liaisons.map((item) => item.id === id
        ? {
            ...item,
            position,
            anchors: {
              ...item.anchors,
              onClassA: localPointForBody(position, bodyA),
              onClassB: localPointForBody(position, bodyB),
            },
          }
        : item),
    };
    validateDocument(document);
    return commitDocument(state, document);
  }),

  addJoint: (type, classA, classB, position, angle = 0) => {
    const id = newId('link');
    set((state) => {
      const definition = Object.hasOwn(state.document.jointDefinitions, type)
        ? state.document.jointDefinitions[type]
        : Object.hasOwn(JOINT_DEFINITIONS, type) ? JOINT_DEFINITIONS[type] : undefined;
      if (!definition) {
        throw new Error(`Unknown joint type ${type}`);
      }
      const bodyA = state.document.classesEquivalence.find(({ id: classId }) => classId === classA);
      const bodyB = state.document.classesEquivalence.find(({ id: classId }) => classId === classB);
      if (!bodyA || !bodyB) {
        throw new Error('Select two existing rigid bodies before adding a joint');
      }
      if (classA === classB) throw new Error('A joint must connect two different rigid bodies');
      const joint: Liaison = {
        id,
        name: `${type.replaceAll('_', ' ').toLowerCase()} ${state.document.liaisons.length + 1}`,
        type,
        classA,
        classB,
        position,
        orientation: { x: 0, y: 0, z: Math.sin(angle / 2), w: Math.cos(angle / 2) },
        anchors: {
          onClassA: localPointForBody(position, bodyA),
          onClassB: localPointForBody(position, bodyB),
        },
        dof: definition.dofTemplate.map((template, index) => ({
          id: `${id}_dof_${index + 1}`,
          type: template.type,
          axisLocal: template.type === 'translation' ? { x: Math.cos(angle - (bodyA.rotation ?? 0)), y: Math.sin(angle - (bodyA.rotation ?? 0)), z: 0 } : template.defaultAxisLocal,
          min: template.defaultMin,
          max: template.defaultMax,
          value: 0,
          unit: template.unit,
        })),
      };
      const document = {
        ...state.document,
        jointDefinitions: {
          ...state.document.jointDefinitions,
          [type]: structuredClone(definition),
        },
        liaisons: [...state.document.liaisons, joint],
      };
      validateDocument(document);
      return {
        ...commitDocument(state, document),
        selectedEntityId: id,
        selectedEntityType: 'Joint',
      };
    });
    return id;
  },

  updateJoint: (id, updates) => set((state) => {
    if (!state.document.liaisons.some((joint) => joint.id === id)) {
      throw new Error(`Unknown joint ${id}`);
    }
    const document: KineoDocument = {
      ...state.document,
      liaisons: state.document.liaisons.map((joint) => {
        if (joint.id !== id) return joint;
        const updated = { ...joint, ...updates };
        if (updates.type && updates.type !== joint.type) {
          const template = state.document.jointDefinitions[updates.type];
          if (!template) throw new Error('Type de liaison inconnu.');
          updated.dof = template.dofTemplate.map((dof, index) => ({
            id: newId(`dof_${index}`), type: dof.type, axisLocal: { ...dof.defaultAxisLocal },
            min: dof.defaultMin, max: dof.defaultMax, value: Math.max(dof.defaultMin, Math.min(0, dof.defaultMax)), unit: dof.unit,
          }));
        }
        if (updates.position || updates.classA || updates.classB) {
          const bodyA = state.document.classesEquivalence.find((body) => body.id === updated.classA);
          const bodyB = state.document.classesEquivalence.find((body) => body.id === updated.classB);
          if (bodyA && bodyB) {
            updated.anchors = {
              ...updated.anchors,
              onClassA: localPointForBody(updated.position, bodyA),
              onClassB: localPointForBody(updated.position, bodyB),
            };
          }
        }
        return updated;
      }),
    };
    const dofIds = new Set(document.liaisons.flatMap((joint) => joint.dof.map((dof) => dof.id)));
    document.kinematics = { ...document.kinematics, drivenDofs: document.kinematics.drivenDofs.filter((dof) => dofIds.has(dof.dofId)) };
    validateDocument(document);
    return commitDocument(state, document);
  }),

  removeEntity: (id, type) => set((state) => {
    const current = state.document;
    let document: KineoDocument;
    let removedJointIds = new Set<string>();
    let removedGeometryIds = new Set<string>();
    if (type === 'Fixation') {
      const body = current.classesEquivalence.find((b) => b.groundFixation?.id === id);
      if (!body?.groundFixation) return state;
      const wasFixed = body.groundFixation.wasFixed;
      document = { ...current, classesEquivalence: current.classesEquivalence.map((b) => {
        if (b.id !== body.id) return b;
        const copy = { ...b, isFixed: wasFixed }; delete copy.groundFixation; return copy;
      }) };
      if (referenceBody(document)?.id !== current.meta.groundBodyId) {
        document = { ...document, meta: { ...document.meta } }; delete document.meta.groundBodyId;
      }
    } else if (type === 'Class') {
      const body = current.classesEquivalence.find((item) => item.id === id);
      if (!body) return state;
      if (body.isFixed) throw new Error('The ground body cannot be deleted');
      const removedJoints = current.liaisons.filter((joint) => joint.classA === id || joint.classB === id);
      removedJointIds = new Set(removedJoints.map((joint) => joint.id));
      removedGeometryIds = new Set(current.geometry.entities.filter((entity) => entity.classId === id).map((entity) => entity.id));
      const removedDofIds = new Set(removedJoints.flatMap((joint) => joint.dof.map((dof) => dof.id)));
      document = {
        ...current,
        classesEquivalence: current.classesEquivalence
          .filter((item) => item.id !== id)
          .map((item) => item.parentId === id ? { ...item, parentId: null } : item),
        liaisons: current.liaisons.filter((joint) => joint.classA !== id && joint.classB !== id),
        geometry: {
          ...current.geometry,
          entities: current.geometry.entities.filter((entity) => entity.classId !== id),
        },
        kinematics: {
          ...current.kinematics,
          drivenDofs: current.kinematics.drivenDofs.filter((dof) => !removedDofIds.has(dof.dofId)),
        },
      };
    } else if (type === 'Joint') {
      const joint = current.liaisons.find((item) => item.id === id);
      if (!joint) return state;
      const removedDofIds = new Set(joint.dof.map((dof) => dof.id));
      document = {
        ...current,
        liaisons: current.liaisons.filter((item) => item.id !== id),
        kinematics: {
          ...current.kinematics,
          drivenDofs: current.kinematics.drivenDofs.filter((dof) => !removedDofIds.has(dof.dofId)),
        },
      };
    } else {
      if (!current.geometry.entities.some((item) => item.id === id)) return state;
      document = {
        ...current,
        geometry: {
          ...current.geometry,
          entities: current.geometry.entities.filter((entity) => entity.id !== id),
        },
      };
    }
    validateDocument(document);
    const selectionWasRemoved = state.selectedEntityType === 'Fixation' && state.selectedEntityId === id ||
      state.selectedEntityType === 'Class' && id === state.selectedEntityId ||
      state.selectedEntityType === 'Joint' && (id === state.selectedEntityId || removedJointIds.has(state.selectedEntityId ?? '')) ||
      state.selectedEntityType === 'Geometry' && (id === state.selectedEntityId || removedGeometryIds.has(state.selectedEntityId ?? ''));
    return {
      ...commitDocument(state, document),
      ...(selectionWasRemoved ? { selectedEntityId: null, selectedEntityType: null } : {}),
    };
  }),

  replaceDocument: (input) => {
    const document = validateKineoV3(input);
    validateReferences(document);
    const snapshot = structuredClone(document);
    set((state) => ({
      ...state,
      document: snapshot,
      savedDocumentJson: JSON.stringify(snapshot),
      undoStack: [],
      redoStack: [],
      selectedEntityId: null,
      selectedEntityType: null,
      documentRevision: state.documentRevision + 1,
    }));
  },

  markDocumentSaved: () => set((state) => ({ savedDocumentJson: JSON.stringify(state.document) })),

  setTitle: (title) => set((state) => {
    const document = { ...state.document, meta: { ...state.document.meta, title } };
    return commitDocument(state, document);
  }),

  undo: () => set((state) => {
    const previous = state.undoStack.at(-1);
    if (!previous) return state;
    return {
      document: previous,
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, state.document],
      ...(!selectionExists(previous, state.selectedEntityId, state.selectedEntityType)
        ? { selectedEntityId: null, selectedEntityType: null }
        : {}),
    };
  }),
  redo: () => set((state) => {
    const next = state.redoStack.at(-1);
    if (!next) return state;
    return {
      document: next,
      undoStack: [...state.undoStack, state.document],
      redoStack: state.redoStack.slice(0, -1),
      ...(!selectionExists(next, state.selectedEntityId, state.selectedEntityType)
        ? { selectedEntityId: null, selectedEntityType: null }
        : {}),
    };
  }),
}));

export const selectUndoAvailable = (state: KineoState): boolean => state.undoStack.length > 0;
export const selectRedoAvailable = (state: KineoState): boolean => state.redoStack.length > 0;
export const selectDocumentDirty = (state: KineoState): boolean =>
  JSON.stringify(state.document) !== state.savedDocumentJson;
