# Contributing to CoMapeo Default Categories

Thank you for your interest in contributing to CoMapeo Default Categories! This
document provides guidelines for making contributions to this project.

## Pull Request Process

All changes to this repository must be made via pull requests. Direct commits to
the `main` branch are not permitted.

### Before Submitting a Pull Request

1. Make your changes in a feature branch
2. Ensure your changes follow the project's code style and conventions
3. **Check the version in [package.json](package.json) is updated since the
   [last release](releases/latest)** according to the versioning guidelines
   below
4. Test your changes by running `npm test`
5. Run `npm run format` to ensure consistent code formatting

## Version Bump Requirements

**Important**: Every pull request must increment the version number in
[package.json](package.json) according to the type of changes made. The version
bump will be automatically validated against your changes.

We follow [Semantic Versioning](https://semver.org/) (MAJOR.MINOR.PATCH):

### MAJOR Version Bump (x.0.0)

A major version bump is required when making **breaking changes** that affect
backwards compatibility:

#### Category Changes

- Changing or removing existing tags in the `tags` property
- Removing a geometry type from the `geometry` array
- Removing a value from the `appliesTo` array

#### Field Changes

- Removing a field from the `fields` property
- Changing the `tagKey` of any field
- Changing the `type` of a field
- Removing or changing existing values in the `options` array
- Changing option properties (other than `label`)

#### Other Breaking Changes

- Removing an entire category
- Removing an entire field definition

### MINOR Version Bump (0.x.0)

A minor version bump is required for **backwards-compatible feature additions
and non-breaking changes**:

#### Category Changes

- Changing `name`, `color`, `icon`, or `sort` properties
- Adding new values to `geometry` or `appliesTo` arrays
- Adding tags via `addTags` or `removeTags`
- Reordering `fields`, `geometry`, or `appliesTo` arrays
- Adding new categories

#### Field Changes

- Changing `label`, `helperText`, or `placeholder` text
- Adding new options to the `options` array
- Changing option `label` values
- Reordering the `options` array
- Adding new fields

#### Other Changes

- Changes to `metadata.json` or `categorySelection.json`
- Changes to `messages.json`
- Editing icons

### PATCH Version Bump (0.0.x)

A patch version bump is appropriate for **bug fixes and minor corrections** that
don't add features or break compatibility:

- Documentation updates
- Changes to messages and translations
- Build script fixes
- Minor bug fixes that don't change functionality
- Any change that doesn't fall into the major or minor categories above

## Validation

Your pull request will automatically run the version check script
([scripts/check-version-bump.js](scripts/check-version-bump.js)) in CI. This
script will:

1. Analyze all changes between your branch and the latest release
2. Determine the minimum required version bump
3. Verify that your version bump is appropriate
4. Fail the check if the version bump is insufficient or missing

## Questions?

If you're unsure about what version bump is required for your changes, feel free
to open a draft pull request and the automated checks will provide guidance.
