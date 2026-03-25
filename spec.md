# TerraMeasure / Field Area Mapper

## Current State
Image/PDF overlays can be added to the map. Each overlay has:
- Opacity slider (0-100%)
- Rotation numeric input (0-360°)
- Corner drag handles on the map for repositioning/resizing
- Remove button

The `OverlayItem` interface has: id, type, dataUrl, label, bounds, opacity, rotation.

## Requested Changes (Diff)

### Add
- **Scale control** in the overlay panel: a numeric input showing scale as a percentage (e.g. 100%), with +/- buttons. Changing scale resizes the overlay by adjusting its bounds symmetrically from center.
- **Alignment helper buttons** in the overlay panel for each overlay:
  - Center on screen (centers overlay at current map view center)
  - Align Top, Align Bottom, Align Left, Align Right (snap to map viewport edges)
  - Crosshair/guide lines that appear while dragging the overlay to help with alignment
- **Blend mode dropdown** per overlay: Normal, Multiply, Screen, Overlay, Darken
- Add `blendMode` and `scale` fields to `OverlayItem` interface in App.tsx

### Modify
- `OverlayItem` interface: add `blendMode: string` (default "normal") and `scale: number` (default 100)
- `onUpdateOverlay` prop type: extend to include `blendMode` and `scale`
- LeftSidebar overlay item UI: add scale input + alignment buttons + blend mode dropdown below existing opacity/rotation controls
- MapView overlay rendering: apply CSS mix-blend-mode from `blendMode` field; on scale change, recompute bounds from center
- App.tsx `handleUpdateOverlay`: handle new `blendMode` and `scale` fields

### Remove
- Nothing removed

## Implementation Plan
1. Update `OverlayItem` in App.tsx to add `blendMode: string` and `scale: number`
2. Update `handleAddOverlay` to set default blendMode and scale when creating new overlays
3. Update `onUpdateOverlay` handler to accept and apply blendMode and scale changes (scale changes recompute bounds proportionally)
4. Update LeftSidebar overlay item UI to add:
   - Scale numeric input with % label and +10/-10 quick buttons
   - Blend mode select dropdown
   - Alignment helper buttons row (center, top, bottom, left, right) with icons
5. Update MapView overlay rendering to apply mix-blend-mode CSS from blendMode field
6. Pass current map view bounds to alignment calculations so alignment buttons can compute correct lat/lng positions
