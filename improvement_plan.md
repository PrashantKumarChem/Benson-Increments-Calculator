# Benson Increments Calculator Improvement Plan

## Overview

This document outlines an execution plan to improve the Benson Increments Calculator interface by reducing visual clutter and enhancing usability with minimal code changes.

## Implementation Steps

### 1. Add Tab-Based Navigation

**Why**: Currently all button groups are stacked vertically, taking up significant screen space. Tabs will organize the content better and reduce scrolling.

**Implementation**:
```python
# Replace the current display code with a tabbed interface
tab = widgets.Tab()
tab.children = [CH_notation_layout, CHO_notation_layout, correction_layout]
tab.set_title(0, 'CH Groups')
tab.set_title(1, 'CHO Groups')
tab.set_title(2, 'Corrections')

# Replace these lines:
# display(CH_notation_layout)
# display(widgets.HTML("<br>"))
# display(CHO_notation_layout)
# display(widgets.HTML("<br>"))
# display(correction_layout)
# With just:
display(tab)
```

### 2. Improve History Display

**Why**: The current "Pressed buttons" display becomes unwieldy with long lists.

**Implementation**:
```python
# Create a scrollable output widget for pressed buttons
pressed_buttons_output = widgets.Output(
    layout={
        'border': '1px solid #ddd',
        'max_height': '150px',
        'min_height': '100px',
        'overflow': 'auto',
        'margin': '10px 0'
    }
)

# Update the add_to_total function
def add_to_total(value, label):
    global total_value_kj, last_value_kj
    total_value_kj += value
    last_value_kj = value
    pressed_buttons.append(label)
    total_label_kj.value = f"Standard heat of formation: {total_value_kj:.2f} kJ/mol"
    total_label_kcal.value = f"Standard heat of formation: {total_value_kj * kj_to_kcal:.2f} kcal/mol"
    
    # Update the pressed buttons display
    pressed_buttons_output.clear_output()
    with pressed_buttons_output:
        for i, btn in enumerate(pressed_buttons, 1):
            print(f"{i}. {btn}")

# Also update the undo_last_action function
def undo_last_action(button):
    global total_value_kj, last_value_kj
    if pressed_buttons:
        total_value_kj -= last_value_kj
        pressed_buttons.pop()
        total_label_kj.value = f"Standard heat of formation: {total_value_kj:.2f} kJ/mol"
        total_label_kcal.value = f"Standard heat of formation: {total_value_kj * kj_to_kcal:.2f} kcal/mol"
        last_value_kj = 0.0
        
        # Update the pressed buttons display
        pressed_buttons_output.clear_output()
        with pressed_buttons_output:
            if pressed_buttons:
                for i, btn in enumerate(pressed_buttons, 1):
                    print(f"{i}. {btn}")
            else:
                print("No increments added yet")
```

### 3. Add a Reset Button

**Why**: Currently users must undo each step individually to restart a calculation.

**Implementation**:
```python
# Create a reset button
reset_button = widgets.Button(
    description="Reset Calculation", 
    layout=widgets.Layout(width="200px", height="25px"),
    button_style='danger'
)

# Function to reset the calculation
def reset_calculation(button):
    global total_value_kj, last_value_kj, pressed_buttons
    total_value_kj = 0.0
    last_value_kj = 0.0
    pressed_buttons = []
    total_label_kj.value = f"Standard heat of formation: {total_value_kj:.2f} kJ/mol"
    total_label_kcal.value = f"Standard heat of formation: {total_value_kj * kj_to_kcal:.2f} kcal/mol"
    
    # Clear the pressed buttons display
    pressed_buttons_output.clear_output()
    with pressed_buttons_output:
        print("No increments added yet")

reset_button.on_click(reset_calculation)

# Create a button container for undo and reset
button_container = widgets.HBox([undo_button, reset_button])
```

### 4. Add Instructions Panel

**Why**: Brief instructions improve usability for first-time users.

**Implementation**:
```python
instructions = widgets.HTML(
    """<div style="background-color: #f8f9fa; padding: 10px; border-radius: 5px; margin-bottom: 10px;">
    <b>Instructions:</b> Select increments from the tabs below to calculate the heat of formation. 
    Use the Undo button to remove the last added increment or Reset to start over.
    </div>"""
)
```

### 5. Update Final Display Code

**Why**: Reorganize the display to implement all the improvements above.

**Implementation**:
```python
# Final display code - replace the current display code with this
display(instructions)
display(tab)
display(button_container)
display(total_label_kj)
display(total_label_kcal)
display(pressed_buttons_output)
```

## Implementation Order

1. First implement the tabbed interface
2. Add the scrollable output for pressed buttons history
3. Add the reset button and button container
4. Add the instructions panel
5. Update the display code

## Expected Result

A cleaner, more organized interface with:
- Tabbed navigation between increment types
- Better history tracking with a scrollable list
- Ability to quickly reset calculations
- Clear instructions for users