import { create } from 'zustand';
import type {
    KineoDocument,
    EquivalenceClass,
    JointDefinition,
    Anchor
} from '../types/kineo';

// État global de l'application Kineo
interface KineoState {
    // Document actif
    document: KineoDocument;

    // États de l'interface (UI)
    activeViewMode: '2D' | '3D' | 'Graph' | 'Split';
    activeAppMode: 'Edit' | 'Simulation';
    selectedEntityId: string | null;
    selectedEntityType: 'Class' | 'Joint' | 'Anchor' | null;

    // Actions de l'interface
    setViewMode: (mode: '2D' | '3D' | 'Graph' | 'Split') => void;
    setAppMode: (mode: 'Edit' | 'Simulation') => void;
    selectEntity: (id: string | null, type: 'Class' | 'Joint' | 'Anchor' | null) => void;

    // Actions sur les données (CRUD)
    addClass: (newClass: Omit<EquivalenceClass, 'id'>) => void;
    addJoint: (newJoint: Omit<JointDefinition, 'id'>) => void;
    addAnchor: (newAnchor: Omit<Anchor, 'id'>) => void;
    removeEntity: (id: string, type: 'Class' | 'Joint' | 'Anchor') => void;

    // Actions de simulation
    setSimulationTime: (time: number) => void;
    toggleSimulationPlay: () => void;
    resetSimulation: () => void;
}

// Document par défaut au démarrage (Bâti initial)
const initialDocument: KineoDocument = {
    version: '3.0',
    metadata: {
        title: 'Nouveau Mécanisme',
        description: 'Projet Kineo initialisé',
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
    },
    classesEquivalence: [
        { id: 'class-0', name: 'Bâti (Solide 0)', color: '#4A5568', isGround: true },
        { id: 'class-1', name: 'Manivelle (Solide 1)', color: '#E53E3E', isGround: false },
    ],
    anchors: [
        { id: 'anchor-0', classId: 'class-0', position: { x: 0, y: 0, z: 0 } },
        { id: 'anchor-1', classId: 'class-1', position: { x: 0, y: 0, z: 0 } },
    ],
    jointDefinitions: [
        {
            id: 'joint-1',
            name: 'Pivot Bâti/Manivelle',
            type: 'Pivoting',
            primaryAnchorId: 'anchor-0',
            secondaryAnchorId: 'anchor-1',
            axis: { x: 0, y: 0, z: 1 },
        },
    ],
    dofTemplate: {
        mobility: 1,
        hyperstatism: 0,
        inputJointIds: ['joint-1'],
    },
    kinematics: {
        timeStep: 0.01,
        duration: 10,
        currentTime: 0,
        isPlaying: false,
    },
};

export const useKineoStore = create<KineoState>((set) => ({
    document: initialDocument,
    activeViewMode: '2D',
    activeAppMode: 'Edit',
    selectedEntityId: null,
    selectedEntityType: null,

    // Changement de vue et de mode
    setViewMode: (mode) => set({ activeViewMode: mode }),
    setAppMode: (mode) => set({ activeAppMode: mode }),
    selectEntity: (id, type) => set({ selectedEntityId: id, selectedEntityType: type }),

    // Ajout d'une classe d'équivalence
    addClass: (newClass) =>
        set((state) => {
            const id = `class-${crypto.randomUUID()}`;
            return {
                document: {
                    ...state.document,
                    classesEquivalence: [...state.document.classesEquivalence, { ...newClass, id }],
                },
            };
        }),

    // Ajout d'une liaison
    addJoint: (newJoint) =>
        set((state) => {
            const id = `joint-${crypto.randomUUID()}`;
            return {
                document: {
                    ...state.document,
                    jointDefinitions: [...state.document.jointDefinitions, { ...newJoint, id }],
                },
            };
        }),

    // Ajout d'une ancre
    addAnchor: (newAnchor) =>
        set((state) => {
            const id = `anchor-${crypto.randomUUID()}`;
            return {
                document: {
                    ...state.document,
                    anchors: [...state.document.anchors, { ...newAnchor, id }],
                },
            };
        }),

    // Suppression globale d'élément
    removeEntity: (id, type) =>
        set((state) => {
            const doc = state.document;
            if (type === 'Class') {
                return {
                    document: {
                        ...doc,
                        classesEquivalence: doc.classesEquivalence.filter((c) => c.id !== id),
                    },
                    selectedEntityId: null,
                    selectedEntityType: null,
                };
            }
            if (type === 'Joint') {
                return {
                    document: {
                        ...doc,
                        jointDefinitions: doc.jointDefinitions.filter((j) => j.id !== id),
                    },
                    selectedEntityId: null,
                    selectedEntityType: null,
                };
            }
            if (type === 'Anchor') {
                return {
                    document: {
                        ...doc,
                        anchors: doc.anchors.filter((a) => a.id !== id),
                    },
                    selectedEntityId: null,
                    selectedEntityType: null,
                };
            }
            return state;
        }),

    // Contrôles de simulation
    setSimulationTime: (time) =>
        set((state) => ({
            document: {
                ...state.document,
                kinematics: { ...state.document.kinematics, currentTime: time },
            },
        })),

    toggleSimulationPlay: () =>
        set((state) => ({
            document: {
                ...state.document,
                kinematics: {
                    ...state.document.kinematics,
                    isPlaying: !state.document.kinematics.isPlaying,
                },
            },
        })),

    resetSimulation: () =>
        set((state) => ({
            document: {
                ...state.document,
                kinematics: { ...state.document.kinematics, currentTime: 0, isPlaying: false },
            },
        })),
}));