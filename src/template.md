---
version: alpha
name: My Design System
description: A short summary of the visual identity.
colors:
  primary: "#1A73E8"
  on-primary: "#FFFFFF"
  surface: "#FFFFFF"
  on-surface: "#1F1F1F"
typography:
  headline:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: 600
    lineHeight: 40px
  body:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 400
    lineHeight: 24px
rounded:
  md: 8px
spacing:
  sm: 8px
  md: 16px
components:
  button:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "{spacing.sm}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
---

# My Design System

## Overview

Describe the personality of the product and who it is for.

## Colors

Explain how the palette is used and which color carries the brand.

## Typography

Describe the type scale and when to use each style.

## Layout

Describe the grid, spacing rhythm and breakpoints.

## Elevation & Depth

Describe how surfaces are layered.

## Shapes

Describe corner radii and other shape language.

## Components

Describe key components and their states.

## Do's and Don'ts

- Do use the primary color for the main action on a screen.
- Don't use more than one primary button per view.
