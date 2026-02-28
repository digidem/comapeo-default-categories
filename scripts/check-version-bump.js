#!/usr/bin/env node

/**
 * Check if the version bump in a PR is appropriate for the changes made.
 *
 * This script compares the current branch with main to determine if changes
 * are major or minor, and validates that the package.json version has been
 * incremented appropriately.
 *
 * Major changes:
 * - Existing tags changed in category tags property
 * - Removing a field from fields prop
 * - Removing or changing existing values from options array
 * - Changing tagKey on any field
 * - Changing field type
 * - Removing geometry type or appliesTo value from category
 *
 * Minor changes:
 * - Changing label, helperText, placeholder, placeholder of fields
 * - Changing name, color, icon, sort of category
 * - Adding values to geometry, appliesTo, fields
 * - Changing order of fields, geometry, appliesTo, options
 * - Adding tags, addTags, removeTags
 * - Adding options to fields
 * - Changing option labels
 * - Editing icons
 * - Changes to metadata.json or categorySelection.json
 * - Changes to messages.json
 * - Adding new categories or fields
 */

const fs = require("fs");
const path = require("path");

// Paths relative to repo root
const RELEASE_DIR = process.argv[2];
const PR_DIR = process.argv[3];

if (!RELEASE_DIR || !PR_DIR) {
  console.error(
    "Usage: node check-version-bump.js <path-to-main-checkout> <path-to-pr-checkout>",
  );
  process.exit(1);
}

/**
 * Get all JSON files in a directory
 */
function getJsonFiles(dir, subdir) {
  const fullPath = path.join(dir, subdir);
  if (!fs.existsSync(fullPath)) return {};

  const files = fs.readdirSync(fullPath).filter((f) => f.endsWith(".json"));
  const result = {};

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(fullPath, file), "utf8");
      result[file] = JSON.parse(content);
    } catch (e) {
      console.error(`Error reading ${subdir}/${file}: ${e.message}`);
    }
  }

  return result;
}

/**
 * Deep equality check for primitives and simple objects
 */
function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (typeof a === "object" && typeof b === "object") {
    const keysA = Object.keys(a).sort();
    const keysB = Object.keys(b).sort();
    if (!deepEqual(keysA, keysB)) return false;

    for (const key of keysA) {
      if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
  }

  return false;
}

/**
 * Check if arrays have the same values (ignoring order)
 */
function sameValues(arr1, arr2) {
  if (!Array.isArray(arr1) || !Array.isArray(arr2)) return false;
  if (arr1.length !== arr2.length) return false;

  const sorted1 = [...arr1].sort();
  const sorted2 = [...arr2].sort();

  return deepEqual(sorted1, sorted2);
}

/**
 * Check if an array is a reordering of another (same elements, different order)
 */
function isReordering(arr1, arr2) {
  return !deepEqual(arr1, arr2) && sameValues(arr1, arr2);
}

/**
 * Compare two field definitions
 */
function compareFields(oldField, newField, filename) {
  const changes = { major: [], minor: [] };

  // Check tagKey change (major)
  if (oldField.tagKey !== newField.tagKey) {
    changes.major.push(
      `tagKey changed from "${oldField.tagKey}" to "${newField.tagKey}"`,
    );
  }

  // Check type change (major)
  if (oldField.type !== newField.type) {
    changes.major.push(
      `type changed from "${oldField.type}" to "${newField.type}"`,
    );
  }

  // Check label, helperText, placeholder changes (minor)
  if (oldField.label !== newField.label) {
    changes.minor.push(`label changed`);
  }
  if (oldField.helperText !== newField.helperText) {
    changes.minor.push(`helperText changed`);
  }
  if (oldField.placeholder !== newField.placeholder) {
    changes.minor.push(`placeholder changed`);
  }

  // Check options changes
  if (oldField.options || newField.options) {
    const oldOptions = oldField.options || [];
    const newOptions = newField.options || [];

    // Build maps of value -> option for comparison
    const oldOptionsMap = new Map(oldOptions.map((opt) => [opt.value, opt]));
    const newOptionsMap = new Map(newOptions.map((opt) => [opt.value, opt]));

    // Check for removed or changed options (major)
    for (const [value, oldOpt] of oldOptionsMap) {
      if (!newOptionsMap.has(value)) {
        changes.major.push(`option with value "${value}" removed`);
      } else {
        const newOpt = newOptionsMap.get(value);
        // If value exists but other properties changed
        if (oldOpt.label !== newOpt.label) {
          changes.minor.push(`option label changed for value "${value}"`);
        }
        // Check if any other properties besides label changed (would be major)
        const oldOptWithoutLabel = { ...oldOpt };
        const newOptWithoutLabel = { ...newOpt };
        delete oldOptWithoutLabel.label;
        delete newOptWithoutLabel.label;
        if (!deepEqual(oldOptWithoutLabel, newOptWithoutLabel)) {
          changes.major.push(`option properties changed for value "${value}"`);
        }
      }
    }

    // Check for added options (minor)
    for (const value of newOptionsMap.keys()) {
      if (!oldOptionsMap.has(value)) {
        changes.minor.push(`option with value "${value}" added`);
      }
    }

    // Check for reordering (minor)
    const oldValues = oldOptions.map((o) => o.value);
    const newValues = newOptions.map((o) => o.value);
    if (isReordering(oldValues, newValues)) {
      changes.minor.push(`options reordered`);
    }
  }

  return changes;
}

/**
 * Compare two category definitions
 */
function compareCategories(oldCat, newCat, filename) {
  const changes = { major: [], minor: [] };

  // Check for tag changes (major if existing tags changed, minor if added)
  if (oldCat.tags || newCat.tags) {
    const oldTags = oldCat.tags || {};
    const newTags = newCat.tags || {};

    // Check if any existing tag keys changed or were removed
    for (const [key, value] of Object.entries(oldTags)) {
      if (!(key in newTags)) {
        changes.major.push(`tag "${key}" removed`);
      } else if (oldTags[key] !== newTags[key]) {
        changes.major.push(
          `tag "${key}" changed from "${value}" to "${newTags[key]}"`,
        );
      }
    }

    // Check for added tags (minor)
    for (const key of Object.keys(newTags)) {
      if (!(key in oldTags)) {
        changes.minor.push(`tag "${key}" added`);
      }
    }
  }

  // Check addTags and removeTags (minor)
  if (!deepEqual(oldCat.addTags, newCat.addTags)) {
    changes.minor.push(`addTags changed`);
  }
  if (!deepEqual(oldCat.removeTags, newCat.removeTags)) {
    changes.minor.push(`removeTags changed`);
  }

  // Check fields array
  if (oldCat.fields || newCat.fields) {
    const oldFields = oldCat.fields || [];
    const newFields = newCat.fields || [];

    // Check for removed fields (major)
    for (const field of oldFields) {
      if (!newFields.includes(field)) {
        changes.major.push(`field "${field}" removed`);
      }
    }

    // Check for added fields (minor)
    for (const field of newFields) {
      if (!oldFields.includes(field)) {
        changes.minor.push(`field "${field}" added`);
      }
    }

    // Check for reordering (minor)
    if (isReordering(oldFields, newFields)) {
      changes.minor.push(`fields reordered`);
    }
  }

  // Check geometry array
  if (oldCat.geometry || newCat.geometry) {
    const oldGeom = oldCat.geometry || [];
    const newGeom = newCat.geometry || [];

    // Check for removed geometry types (major)
    for (const geom of oldGeom) {
      if (!newGeom.includes(geom)) {
        changes.major.push(`geometry type "${geom}" removed`);
      }
    }

    // Check for added geometry types (minor)
    for (const geom of newGeom) {
      if (!oldGeom.includes(geom)) {
        changes.minor.push(`geometry type "${geom}" added`);
      }
    }

    // Check for reordering (minor)
    if (isReordering(oldGeom, newGeom)) {
      changes.minor.push(`geometry reordered`);
    }
  }

  // Check appliesTo array
  if (oldCat.appliesTo || newCat.appliesTo) {
    const oldApplies = oldCat.appliesTo || [];
    const newApplies = newCat.appliesTo || [];

    // Check for removed appliesTo values (major)
    for (const val of oldApplies) {
      if (!newApplies.includes(val)) {
        changes.major.push(`appliesTo value "${val}" removed`);
      }
    }

    // Check for added appliesTo values (minor)
    for (const val of newApplies) {
      if (!oldApplies.includes(val)) {
        changes.minor.push(`appliesTo value "${val}" added`);
      }
    }

    // Check for reordering (minor)
    if (isReordering(oldApplies, newApplies)) {
      changes.minor.push(`appliesTo reordered`);
    }
  }

  // Check name, color, icon, sort changes (minor)
  if (oldCat.name !== newCat.name) {
    changes.minor.push(`name changed`);
  }
  if (oldCat.color !== newCat.color) {
    changes.minor.push(`color changed`);
  }
  if (oldCat.icon !== newCat.icon) {
    changes.minor.push(`icon changed`);
  }
  if (oldCat.sort !== newCat.sort) {
    changes.minor.push(`sort changed`);
  }

  return changes;
}

/**
 * Parse semver version
 */
function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) throw new Error(`Invalid version format: ${version}`);
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/**
 * Compare versions and determine bump type
 */
function getVersionBumpType(oldVer, newVer) {
  const old = parseVersion(oldVer);
  const newer = parseVersion(newVer);

  if (newer.major > old.major) return "major";
  if (newer.minor > old.minor) return "minor";
  if (newer.patch > old.patch) return "patch";
  return "none";
}

/**
 * Main comparison logic
 */
function analyzeChanges() {
  const allChanges = {
    categories: {},
    fields: {},
    hasMajorChanges: false,
    hasMinorChanges: false,
  };

  // Compare categories
  const oldCategories = getJsonFiles(RELEASE_DIR, "categories");
  const newCategories = getJsonFiles(PR_DIR, "categories");

  // Check modified and removed categories
  for (const [filename, oldCat] of Object.entries(oldCategories)) {
    if (filename in newCategories) {
      const changes = compareCategories(
        oldCat,
        newCategories[filename],
        filename,
      );
      if (changes.major.length > 0 || changes.minor.length > 0) {
        allChanges.categories[filename] = changes;
        if (changes.major.length > 0) allChanges.hasMajorChanges = true;
        if (changes.minor.length > 0) allChanges.hasMinorChanges = true;
      }
    } else {
      // Category removed - this is major
      allChanges.categories[filename] = {
        major: ["Category removed"],
        minor: [],
      };
      allChanges.hasMajorChanges = true;
    }
  }

  // Check new categories (minor)
  for (const filename of Object.keys(newCategories)) {
    if (!(filename in oldCategories)) {
      allChanges.categories[filename] = {
        major: [],
        minor: ["New category added"],
      };
      allChanges.hasMinorChanges = true;
    }
  }

  // Compare fields
  const oldFields = getJsonFiles(RELEASE_DIR, "fields");
  const newFields = getJsonFiles(PR_DIR, "fields");

  // Check modified and removed fields
  for (const [filename, oldField] of Object.entries(oldFields)) {
    if (filename in newFields) {
      const changes = compareFields(oldField, newFields[filename], filename);
      if (changes.major.length > 0 || changes.minor.length > 0) {
        allChanges.fields[filename] = changes;
        if (changes.major.length > 0) allChanges.hasMajorChanges = true;
        if (changes.minor.length > 0) allChanges.hasMinorChanges = true;
      }
    } else {
      // Field removed - this is major
      allChanges.fields[filename] = {
        major: ["Field removed"],
        minor: [],
      };
      allChanges.hasMajorChanges = true;
    }
  }

  // Check new fields (minor)
  for (const filename of Object.keys(newFields)) {
    if (!(filename in oldFields)) {
      allChanges.fields[filename] = {
        major: [],
        minor: ["New field added"],
      };
      allChanges.hasMinorChanges = true;
    }
  }

  return allChanges;
}

/**
 * Main execution
 */
function main() {
  console.log("🔍 Analyzing changes between main and PR...\n");

  // Check that directories exist
  if (!fs.existsSync(RELEASE_DIR)) {
    console.error(
      `❌ Error: Main checkout directory not found: ${RELEASE_DIR}`,
    );
    process.exit(1);
  }

  // Analyze changes
  const changes = analyzeChanges();

  if (Object.keys(changes.categories).length > 0) {
    console.log("📋 Category changes:");
    for (const [filename, change] of Object.entries(changes.categories)) {
      console.log(`\n  ${filename}:`);
      if (change.major.length > 0) {
        console.log("    🔴 Major changes:");
        change.major.forEach((c) => console.log(`      - ${c}`));
      }
      if (change.minor.length > 0) {
        console.log("    🟡 Minor changes:");
        change.minor.forEach((c) => console.log(`      - ${c}`));
      }
    }
  }

  if (Object.keys(changes.fields).length > 0) {
    console.log("\n🏷️  Field changes:");
    for (const [filename, change] of Object.entries(changes.fields)) {
      console.log(`\n  ${filename}:`);
      if (change.major.length > 0) {
        console.log("    🔴 Major changes:");
        change.major.forEach((c) => console.log(`      - ${c}`));
      }
      if (change.minor.length > 0) {
        console.log("    🟡 Minor changes:");
        change.minor.forEach((c) => console.log(`      - ${c}`));
      }
    }
  }

  // Determine required version bump
  const requiredBump = changes.hasMajorChanges
    ? "major"
    : changes.hasMinorChanges
      ? "minor"
      : "patch";
  console.log(`\n📊 Summary:`);
  console.log(
    `   Major changes: ${changes.hasMajorChanges ? "🔴 Yes" : "✅ No"}`,
  );
  console.log(
    `   Minor changes: ${changes.hasMinorChanges ? "🟡 Yes" : "✅ No"}`,
  );
  console.log(`   Required version bump: ${requiredBump.toUpperCase()}`);

  // Check version bump
  const oldPackageJson = JSON.parse(
    fs.readFileSync(path.join(RELEASE_DIR, "package.json"), "utf8"),
  );
  const newPackageJson = JSON.parse(
    fs.readFileSync(path.join(PR_DIR, "package.json"), "utf8"),
  );

  const oldVersion = oldPackageJson.version;
  const newVersion = newPackageJson.version;
  const actualBump = getVersionBumpType(oldVersion, newVersion);

  console.log(`\n📦 Version bump:`);
  console.log(`   Old version: ${oldVersion}`);
  console.log(`   New version: ${newVersion}`);
  console.log(`   Actual bump: ${actualBump.toUpperCase()}`);

  // Validate version bump
  if (actualBump === "none") {
    console.log("\n❌ ERROR: Version has not been incremented!");
    console.log(
      `   Please bump the version by ${requiredBump} in package.json\n`,
    );
    process.exit(1);
  }

  if (requiredBump === "major" && actualBump !== "major") {
    console.log("\n❌ ERROR: Version bump is insufficient!");
    console.log(
      `   Changes require a MAJOR version bump, but only ${actualBump.toUpperCase()} was applied.`,
    );
    console.log("   Please increment the major version in package.json\n");
    process.exit(1);
  }

  if (
    requiredBump === "minor" &&
    actualBump !== "minor" &&
    actualBump !== "major"
  ) {
    console.log("\n❌ ERROR: Version bump is insufficient!");
    console.log(
      "   Changes require a MINOR version bump, but only PATCH was applied.",
    );
    console.log("   Please increment the minor version in package.json\n");
    process.exit(1);
  }

  if (requiredBump === "patch" && actualBump === "none") {
    console.log("\n❌ ERROR: Version bump is insufficient!");
    console.log(
      "   Changes require at least a PATCH version bump, but no bump was applied.",
    );
    console.log("   Please increment the patch version in package.json\n");
    process.exit(1);
  }

  console.log("\n✅ Version bump is appropriate for the changes!\n");
  process.exit(0);
}

main();
