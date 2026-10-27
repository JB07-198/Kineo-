// Types pour les coordonnées 2D / 3D
export interface Vector2D {
    x: number;
    y: number;
}

export interface Vector3D {
    x: number;
    y: number;
    z: number;
}

// Repères et ancres locales pour les liaisons
export interface Anchor {
    id: string;
    classId: string; // Référence à la classe d'équivalence (bâti/solide)
    position: Vector3D;
    orientation?: Vector3D; // Angles d'Euler en radians si nécessaire
}

// Types de liaisons ISO/AFNOR supportées
export type JointType =
    | 'Pivoting'        // Pivot
    | 'Prismatic'       // Glissière
    | 'Cylindrical'     // Pivot glissant
    | 'Spherical'       // Rotule
    | 'Planar'          // Appui plan
    | 'Helicoidal'      // Hélicoïdale
    | 'Fixed';          // Encastrement

// Définition d'une liaison mécanique (instanciée dans le store)
export interface JointDefinition {
    id: string;
    name: string;
    type: JointType;
    primaryAnchorId: string;
    secondaryAnchorId: string;
    axis?: Vector3D;       // Axe de la liaison (ex: [0, 0, 1] pour z)
    limits?: {
        min?: number;
        max?: number;
    };
}

// Modèle de définition de joint utilisé dans le format canonique JSON v3.0
export interface JointDefinitionTemplate {
    isoCode: string;
    dofCount: number;
    dofTemplate: Array<{
        type: string;
        defaultAxisLocal: Vector3D;
        defaultMin: number;
        defaultMax: number;
        unit: string;
    }>;
}

// Classe d'équivalence cinématique (Solide indéformable)
export interface EquivalenceClass {
    id: string;
    name: string;
    color: string;
    isGround: boolean;     // true s'il s'agit du Bâti (Classe 0)
}

// Bloc de résolution cinématique (état du solveur)
export interface KinematicsSolverBlock {
    timeStep: number;
    duration: number;
    currentTime: number;
    isPlaying: boolean;
}

// Template des degrés de liberté (global)
export interface DOFTemplate {
    mobility: number;      // Degré de mobilité m
    hyperstatism: number;  // Degré d'hyperstatisme h
    inputJointIds: string[]; // Liaisons motorisées/pilotes
}

// Données du solveur et état de la simulation (instance)
export interface Liaison {
    id: string;
    name: string;
    type: string;
    classA: string;
    classB: string;
    position: Vector3D;
    orientation: {
        x: number;
        y: number;
        z: number;
        w: number;
    };
    anchors: {
        _comment?: string;
        onClassA: Vector3D;
        onClassB: Vector3D;
    };
    dof: Array<{
        id: string;
        type: string;
        axisLocal: Vector3D;
        min: number;
        max: number;
        value: number;
        unit: string;
    }>;
}

export interface DrivenDOF {
    dofId: string;
    controlType: string;
    targetValue: number;
    unit: string;
}

export interface GeometryEntity {
    id: string;
    kind: string;
    classId: string;
    localPoints: Vector3D[];
    style: {
        stroke: string;
        width: number;
        color: string;
    };
    view: string;
}

// Modèle global JSON v3.0 pour Kineo
export interface KineoDocument {
    // Métadonnées canonique JSON v3.0
    meta?: {
        schemaVersion: string;
        appVersion: string;
        title: string;
        author: string;
        lengthUnit: string;
        angleUnit: string;
    };
    // Compatibilité rétro‑compatibilité
    metadata?: {
        title: string;
        description?: string;
        author?: string;
        created: string;
        lastModified: string;
    };
    classesEquivalence: EquivalenceClass[];
    anchors: Anchor[];
    // Définition des joints – format canonique (record)
    jointDefinitions: Record<string, JointDefinitionTemplate>;
    // Liaisons instanciées (optionnel)
    liaisons?: Liaison[];
    // Bloc cinématique
    kinematics: KinematicsSolverBlock & {
        solverType?: string;
        closedLoopMode?: boolean;
        drivenDofs?: DrivenDOF[];
    };
    // Géométrie
    geometry?: {
        entities: GeometryEntity[];
    };
    // Template global des DOF
    dofTemplate: DOFTemplate;
    version: '3.0';
}
