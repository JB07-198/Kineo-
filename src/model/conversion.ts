// src/model/conversion.ts
// Conversion utilities between the external canonical JSON v3.0 model (KineoV3)
// and the internal TypeScript model used by the store (KineoDocument).

import type { KineoV3 } from './jsonV3';
import type { KineoDocument } from '../types/kineo';

/**
 * Convert a parsed KineoV3 object (external schema) to the internal KineoDocument.
 * At the moment the internal model mirrors the external one, so this is a shallow copy.
 * Future adaptations can map field names or perform transformations here.
 */
export function toInternalModel(external: KineoV3): KineoDocument {
  // Direct cast – both interfaces share the same structural shape.
  // Types are compatible because KineoDocument includes the same fields
  // (meta, metadata?, classesEquivalence, anchors, jointDefinitions, liaisons,
  // kinematics, geometry, dofTemplate, version).
  const internal = external as unknown as KineoDocument;
  return internal;
}

/**
 * Convert an internal KineoDocument back to the canonical external KineoV3 format.
 */
export function fromInternalModel(internal: KineoDocument): KineoV3 {
  // Ensure we return an object that satisfies KineoV3.
  const external = internal as unknown as KineoV3;
  return external;
}

/**
 * Validate that all identifier references inside the document are coherent.
 * Throws an Error with a descriptive message if an inconsistency is found.
 */
export function validateReferences(doc: KineoDocument): void {
  const classIds = new Set(doc.classesEquivalence.map((c) => c.id));
  // const anchorIds = new Set(doc.anchors.map((a) => a.id)); // not needed for current checks

  // Check liaisons class references
  doc.liaisons?.forEach((l) => {
    if (!classIds.has(l.classA)) {
      throw new Error(`Liaison ${l.id} references unknown classA ${l.classA}`);
    }
    if (!classIds.has(l.classB)) {
      throw new Error(`Liaison ${l.id} references unknown classB ${l.classB}`);
    }
    // anchors inside liaison are not stored separately, they are coordinates.
  });

  // Check joint definitions ids against liaisons types
  const jointTypes = Object.keys(doc.jointDefinitions);
  doc.liaisons?.forEach((l) => {
    if (!jointTypes.includes(l.type)) {
      throw new Error(`Liaison ${l.id} uses unknown joint type ${l.type}`);
    }
  });
}

/**
 * Detect loss of information when converting between models.
 * Returns an array of paths that were dropped (if any).
 */
export function detectConversionLosses(original: KineoV3, converted: KineoV3): string[] {
  const losses: string[] = [];
  const recurse = (orig: any, conv: any, path: string) => {
    if (typeof orig !== typeof conv) {
      losses.push(path);
      return;
    }
    if (orig && typeof orig === 'object') {
      if (Array.isArray(orig)) {
        if (!Array.isArray(conv) || orig.length !== conv.length) {
          losses.push(path);
          return;
        }
        orig.forEach((v, i) => recurse(v, conv[i], `${path}[${i}]`));
      } else {
        for (const key of Object.keys(orig)) {
          if (!(key in conv)) {
            losses.push(`${path}.${key}`);
          } else {
            recurse(orig[key], conv[key], path ? `${path}.${key}` : key);
          }
        }
      }
    }
  };
  recurse(original, converted, '');
  return losses;
}

