import { create } from 'zustand';
import type { EquivalenceClass, KineoDocument } from '../types/kineo';
import type { Liaison, Vector3 } from '../model/jsonV3';
import { createDefaultDocument, JOINT_DEFINITIONS } from '../model/defaultDocument';
import { validateReferences } from '../model/conversion';
import { validateKineoV3 } from '../model/validation';

type SelectionType = 'Class' | 'Joint' | 'Geometry';
type ViewMode = '2D' | '3D' | 'Graph' | 'Split';

interface KineoState {
  document: KineoDocument;
  activeViewMode: ViewMode;
  activeAppMode: 'Edit' | 'Simulation';
  selectedEntityId: string | null;
  selectedEntityType: SelectionType | null;
  savedDocumentJson: string;
  gridVisible: boolean;
  snapEnabled: boolean;
  undoStack: KineoDocument[];
  redoStack: KineoDocument[];
  setViewMode: (mode: ViewMode) => void;
  setAppMode: (mode: 'Edit' | 'Simulation') => void;
  selectEntity: (id: string | null, type: SelectionType | null) => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  addClass: (name: string, position: Vector3) => string;
  updateClass: (id: string, updates: Partial<Pick<EquivalenceClass, 'name' | 'color' | 'position' | 'rotation'>>) => void;
  beginEdit: () => void;
  moveClass: (id: string, position: Vector3) => void;
  moveJoint: (id: string, position: Vector3) => void;
  updateJointAnchor: (id: string, frame: 'onClassA' | 'onClassB', anchor: Vector3) => void;
  addJoint: (type: string, classA: string, classB: string, position: Vector3) => string;
  updateJoint: (id: string, updates: Partial<Pick<Liaison, 'name' | 'classA' | 'classB' | 'position' | 'dof'>>) => void;
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

export const useKineoStore = create<KineoState>((set) => ({
  document: initialDocument,
  activeViewMode: '2D',
  activeAppMode: 'Edit',
  selectedEntityId: null,
  selectedEntityType: null,
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

  addClass: (name, position) => {
    const id = newId('eq');
    set((state) => {
      const palette = ['#e63946', '#2a9d8f', '#457b9d', '#f4a261', '#9b5de5'];
      const index = state.document.classesEquivalence.length - 1;
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
              onClassA: localPointForBody(position, bodyA),
              onClassB: localPointForBody(position, bodyB),
            },
          }
        : item),
    };
    validateDocument(document);
    return commitDocument(state, document);
  }),

  addJoint: (type, classA, classB, position) => {
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
        orientation: { x: 0, y: 0, z: 0, w: 1 },
        anchors: {
          onClassA: localPointForBody(position, bodyA),
          onClassB: localPointForBody(position, bodyB),
        },
        dof: definition.dofTemplate.map((template, index) => ({
          id: `${id}_dof_${index + 1}`,
          type: template.type,
          axisLocal: template.defaultAxisLocal,
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
    validateDocument(document);
    return commitDocument(state, document);
  }),

  removeEntity: (id, type) => set((state) => {
    const current = state.document;
    let document: KineoDocument;
    let removedJointIds = new Set<string>();
    let removedGeometryIds = new Set<string>();
    if (type === 'Class') {
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
    const selectionWasRemoved = state.selectedEntityType === 'Class' && id === state.selectedEntityId ||
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
