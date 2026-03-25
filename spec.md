# TerraMeasure

## Current State
- App has polygon drawing mode only
- Default karam scale is 5.6 feet
- LeftSidebar has basic drawing tools: Draw, Undo, Close, Clear
- MapView handles polygon/polyline rendering and GPS tracking

## Requested Changes (Diff)

### Add
- Drawing tool selector with AutoCAD-style tools: Polygon, Line, Polyline, Rectangle, Circle
- Each tool has its own behavior on map click
- New `drawTool` state in App.tsx (type: 'polygon' | 'line' | 'polyline' | 'rectangle' | 'circle')
- Rectangle tool: first click = corner, second click = opposite corner, auto-computes 4 points
- Circle tool: first click = center, second click = edge point, shows radius measurement
- Line tool: places exactly 2 points then auto-closes/completes
- Polyline tool: places multiple points as open path (no fill)
- Polygon tool: existing behavior (close creates filled polygon)
- Tool palette in LeftSidebar with icon buttons for each tool type

### Modify
- Default `karamScale` in App.tsx: change from 5.6 to 5.5
- LeftSidebar Drawing Tools section: replace single Draw button with tool palette grid
- MapView: accept `drawTool` prop and handle click differently per tool
- MapView rendering: render polygon fill only for polygon mode; polyline/line render as open path; rectangle shows filled rect; circle shows circle shape

### Remove
- Nothing removed

## Implementation Plan
1. In App.tsx: change `useState(5.6)` to `useState(5.5)` for karamScale; add `drawTool` state; pass to LeftSidebar and MapView
2. In LeftSidebar: add tool palette with 5 tool buttons (Polygon, Line, Polyline, Rectangle, Circle) with icons; show active tool highlighted; pass `drawTool` and `onDrawToolChange` props
3. In MapView: add `drawTool` prop; for Rectangle - track 2 clicks and compute corners; for Circle - track center + radius point; for Line - auto-stop after 2 points; adjust rendering based on tool type
4. Update TypeScript interfaces throughout
