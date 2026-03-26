# TerraMeasure

## Current State
Image overlays can be resized via corner handles but cannot be dragged from a chosen anchor point.

## Requested Changes (Diff)

### Add
- Anchor-point drag for image overlays: user picks any point on the overlay as a drag anchor, then drags from that exact spot.

### Modify
- MapView.tsx: add anchor-pick mode and draggable anchor marker that moves the whole overlay.
- LeftSidebar: add "Drag from Point" toggle button for overlay controls.
- App.tsx: add anchorPoint field to OverlayItem and anchorPickMode state.

### Remove
- Nothing.

## Implementation Plan
1. Add anchorPoint (0-1 normalized) to OverlayItem in App.tsx.
2. Add anchorPickMode boolean state + active overlay id in App.tsx, pass to MapView and LeftSidebar.
3. LeftSidebar: "Drag from Point" button toggles anchor-pick mode with hint text.
4. MapView: transparent rectangle over overlay; click sets anchor when in pick mode. Crosshair at anchor. Draggable anchor marker moves entire overlay bounds.
