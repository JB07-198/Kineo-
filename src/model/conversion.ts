import type { KineoV3 } from './jsonV3';
import type { KineoDocument } from '../types/kineo';

export function toInternalModel(external: KineoV3): KineoDocument {
  return structuredClone(external);
}

export function fromInternalModel(internal: KineoDocument): KineoV3 {
  return structuredClone(internal);
}

export function validateReferences(doc: KineoV3): void {
  assertUniqueIds(doc.classesEquivalence.map(({ id }) => id), 'class');
  assertUniqueIds(doc.liaisons.map(({ id }) => id), 'joint');
  assertUniqueIds(doc.geometry.entities.map(({ id }) => id), 'geometry');

  const classes = new Map(doc.classesEquivalence.map((item) => [item.id, item]));
  const dofIds = new Set<string>();

  for (const body of doc.classesEquivalence) {
    if (body.parentId !== null && !classes.has(body.parentId)) {
      throw new Error(`Class ${body.id} references unknown parent ${body.parentId}`);
    }
    if (body.parentId === body.id) {
      throw new Error(`Class ${body.id} cannot be its own parent`);
    }
    const ancestors = new Set([body.id]);
    let parentId = body.parentId;
    while (parentId !== null) {
      if (ancestors.has(parentId)) {
        throw new Error(`Class hierarchy contains a cycle at ${parentId}`);
      }
      ancestors.add(parentId);
      parentId = classes.get(parentId)?.parentId ?? null;
    }
  }

  for (const joint of doc.liaisons) {
    if (!classes.has(joint.classA)) {
      throw new Error(`Joint ${joint.id} references unknown classA ${joint.classA}`);
    }
    if (!classes.has(joint.classB)) {
      throw new Error(`Joint ${joint.id} references unknown classB ${joint.classB}`);
    }
    if (joint.classA === joint.classB) {
      throw new Error(`Joint ${joint.id} cannot connect a class to itself`);
    }
    if (!doc.jointDefinitions[joint.type]) {
      throw new Error(`Joint ${joint.id} uses unknown type ${joint.type}`);
    }
    for (const dof of joint.dof) {
      if (dofIds.has(dof.id)) {
        throw new Error(`Duplicate degree-of-freedom id ${dof.id}`);
      }
      dofIds.add(dof.id);
    }
  }

  for (const entity of doc.geometry.entities) {
    if (!classes.has(entity.classId)) {
      throw new Error(`Geometry ${entity.id} references unknown class ${entity.classId}`);
    }
  }

  for (const drivenDof of doc.kinematics.drivenDofs) {
    if (!dofIds.has(drivenDof.dofId)) {
      throw new Error(`Driven degree of freedom references unknown id ${drivenDof.dofId}`);
    }
  }
}

function assertUniqueIds(ids: string[], entity: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      throw new Error(`Duplicate ${entity} id ${id}`);
    }
    seen.add(id);
  }
}

export function detectConversionLosses(original: unknown, converted: unknown): string[] {
  const losses: string[] = [];

  const compare = (source: unknown, target: unknown, path: string): void => {
    if (typeof source !== typeof target || source === null || target === null) {
      if (source !== target) losses.push(path || '<root>');
      return;
    }
    if (Array.isArray(source)) {
      if (!Array.isArray(target) || source.length !== target.length) {
        losses.push(path || '<root>');
        return;
      }
      source.forEach((value, index) => compare(value, target[index], `${path}[${index}]`));
      return;
    }
    if (typeof source === 'object') {
      if (typeof target !== 'object' || target === null || Array.isArray(target)) {
        losses.push(path || '<root>');
        return;
      }
      for (const [key, value] of Object.entries(source)) {
        if (!(key in target)) {
          losses.push(path ? `${path}.${key}` : key);
        } else {
          compare(value, (target as Record<string, unknown>)[key], path ? `${path}.${key}` : key);
        }
      }
    } else if (source !== target) {
      losses.push(path || '<root>');
    }
  };

  compare(original, converted, '');
  return losses;
}
