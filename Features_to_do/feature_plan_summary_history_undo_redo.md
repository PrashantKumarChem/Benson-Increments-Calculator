

# Phased Plan: Simple History Panel First, Unified Undo/Redo Later

## Overview


This document outlines a phased plan to enhance the Benson Increments Calculator:

**Phase 1: Simple History Panel with Remove Buttons**
- A live summary/history of all selections (increments/corrections)
- The ability to remove any selection at any time (random-access removal)

**Phase 2: Unified Interactive History Panel with Undo/Redo**
- Adds multi-level undo/redo (sequential and random-access)
- Combines random-access removal and sequential undo/redo for maximum flexibility

This approach allows you to implement the easier, high-impact feature first, and add more advanced functionality later.

---



## Phase 1: Simple History Panel with Remove Buttons

### Goals
- Display a live, scrollable list of all selected increments/corrections.
- Allow users to remove any selection from the list (random-access removal).
- Keep the UI and state always in sync.

### Steps
1. **Add a `widgets.Output()` panel below the calculator UI.**
   - Initialize this output widget in the global state.
2. **Create a function `update_history_panel()`**
   - This function clears and redraws the panel after every change.
   - For each entry in the selection history, display:
     - The label (increment/correction name)
     - A small "Remove" button next to it
3. **Implement the remove callback.**
   - When a "Remove" button is clicked, remove the corresponding entry from the history and recalculate the total from scratch.
   - Call `update_labels()` and `update_history_panel()`.
4. **Call `update_history_panel()` after every add, remove, or reset action.**

### Notes
- This approach is simple and high-impact.
- The panel can be styled for better readability if desired.
- Always recalculate the total from the current history after any change.

### Phase 1 Checklist
- [x] Add a widgets.Output() history panel below the calculator UI
- [x] Implement update_history_panel() to redraw the panel after every change
- [x] Add Remove buttons for each entry in the history
- [x] Implement remove callback to update state and recalculate total
- [x] Call update_history_panel() after every relevant action
- [x] Test all combinations and edge cases

---

## Phase 2: Unified Interactive History Panel with Undo/Redo

### Goals
- Add multi-level undo/redo (sequential and random-access)
- Combine random-access removal and sequential undo/redo for maximum flexibility

### Steps
1. **Add a `redo_history` list to the global state.**
2. **Implement undo/redo stacks:**
   - Undo: Remove the last action from the history and push it to `redo_history`.
   - Redo: Pop from `redo_history` and re-apply to the main history.
   - Clear `redo_history` whenever a new increment is added or an item is removed.
3. **Add Undo and Redo buttons next to Reset.**
   - Disable Redo if `redo_history` is empty.
4. **Call `update_history_panel()` after every add, undo, redo, remove, or reset action.**

### Notes
- This approach unifies random-access removal and sequential undo/redo.
- The panel can be styled for better readability if desired.
- Always recalculate the total from the current history after any change.

### Phase 2 Checklist
- [ ] Add redo_history stack for undo/redo
- [ ] Implement Undo and Redo button callbacks
- [ ] Clear redo_history on new add/remove
- [ ] Call update_history_panel() after every relevant action
- [ ] Test all combinations and edge cases

---


## 2. Testing & Validation
- Test all combinations: add, undo, redo, remove, reset.
- Ensure the total and history panel always reflect the true state.
- Check for edge cases (e.g., removing the only item, undoing after removal, etc.).

---



---

## Optional Enhancements
- Add scrollbars or pagination to the history panel for long lists.
- Add confirmation dialogs for removal if desired.
- Style the panel and buttons for better aesthetics.

---

## Risks & Mitigations
- **Risk:** UI becomes cluttered with too many buttons.
   - *Mitigation:* Use compact button styles and consider collapsible panels.
- **Risk:** State desynchronization between lists and total.
   - *Mitigation:* Always recalculate the total from the lists after any change.

---

## Acceptance Criteria
- Users can see a live summary/history of all selections.
- Users can remove any selection and see the total update.
- Users can undo and redo multiple actions (after Phase 2).
- The UI remains stable and intuitive throughout.
