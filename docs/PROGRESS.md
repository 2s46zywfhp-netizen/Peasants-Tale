# Progress
Current phase: 5
Resume point: none
## Checklist
- [ ] 1. AUDIT.md lists all gaps found and every one is fixed or explained under Blocked.
- [ ] 2. Crisp, even pixels at integer scale on all five viewports (verified by screenshot).
- [ ] 3. Pinch and double-tap zoom are impossible on iOS.
- [ ] 4. All 32 palette colours enforced by an automated test across every generated sprite sheet.
- [ ] 5. Every sprite, animation, tile and scene from Phases 3 and 5 exists at the new resolution and appears in the Sprite Gallery.
- [ ] 6. Lighting, LUT seasons, weather, parallax and water all visibly working.
- [ ] 7. Interaction prompts appear for every usable object.
- [ ] 8. Existing saves load correctly after the update.
- [ ] 9. 60fps on a mid-range phone; no per-frame allocations in the render loop.
- [ ] 10. Screenshots committed to docs/screenshots/; full test suite green; CHANGELOG updated.
## Blocked
- **Phase 1 #1 (iOS home screen):** needs a check on a real iPhone, which isn't possible from the cloud container. Everything it depends on is in place: apple-mobile-web-app-capable, black-translucent status bar, apple-touch-icon, viewport-fit=cover with safe-area padding, manifest display fullscreen/standalone and portrait. To check: Safari -> Share -> Add to Home Screen -> launch.
