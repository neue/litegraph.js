import type { LGraphCanvas } from "@/LGraphCanvas"
import type { LGraphNode } from "@/LGraphNode"
import type { CanvasMouseEvent } from "@/types/events"
import type { IGradientWidget, IWidgetGradientOptions, IWidgetGradientStop } from "@/types/widgets"

import { BaseWidget, type DrawWidgetOptions } from "./BaseWidget"

// Global singleton color input element for stop color editing
let globalColorInput: HTMLInputElement | null = null;
let activeGradientWidget: GradientWidget | null = null;
let activeStopIndex: number = -1;
let currentOptions: {
  e: CanvasMouseEvent;
  node: LGraphNode;
  canvas: LGraphCanvas;
} | null = null;
let animationFrameId: number | null = null;
let pendingUpdate = false;

// Mixing algorithm types
type MixingAlgorithm = 'RGB' | 'Oklab' | 'CIELAB';
const MIXING_ALGORITHMS: MixingAlgorithm[] = ['RGB', 'Oklab', 'CIELAB'];

// Create or get the global color input
function getGlobalColorInput(): HTMLInputElement {
  if (!globalColorInput) {
    globalColorInput = document.createElement("input");
    globalColorInput.type = "color";
    globalColorInput.style.position = "absolute";
    globalColorInput.style.width = "0";
    globalColorInput.style.height = "0";
    globalColorInput.style.padding = "0";
    globalColorInput.style.border = "none"; 
    globalColorInput.style.opacity = "0";
    globalColorInput.style.pointerEvents = "none";
    globalColorInput.style.zIndex = "10000";
    document.body.appendChild(globalColorInput);
    
    // Handle color changes with animation frame throttling
    globalColorInput.addEventListener("input", handleColorChange);
    
    // Handle blur for cleanup
    globalColorInput.addEventListener("blur", hideGlobalColorInput);
    
    // Handle change for final value
    globalColorInput.addEventListener("change", () => {
      // Always apply the final value immediately
      if (globalColorInput && activeGradientWidget && currentOptions && activeStopIndex !== -1) {
        applyColorChange();
      }
      setTimeout(hideGlobalColorInput, 100);
    });
  }
  return globalColorInput;
}

// Schedule a color update for next animation frame
function handleColorChange() {
    console.log("handleColorChange");
    
  if (!globalColorInput || !activeGradientWidget || !currentOptions || activeStopIndex === -1) return;
  
  // Get the current color of the active stop
  const currentColor = activeGradientWidget.value[activeStopIndex]?.color;
  
  // Skip if value hasn't changed
  if (globalColorInput.value === currentColor) return;
  
  pendingUpdate = true;
  
  // Use animation frame throttling to avoid too many updates
  if (animationFrameId === null) {
    animationFrameId = requestAnimationFrame(() => {
      if (pendingUpdate) {
        applyColorChange();
        
        // Make sure the node is redrawn by setting the dirty canvas
        if (currentOptions?.node) {
          currentOptions.node.setDirtyCanvas(true, true);
        }
      }
      animationFrameId = null;
    });
  }
}

// Apply the current color change to the active stop
function applyColorChange() {
    console.log("applyColorChange");
  if (globalColorInput && activeGradientWidget && currentOptions && activeStopIndex !== -1) {
    const stops = [...activeGradientWidget.value];
    stops[activeStopIndex].color = globalColorInput.value;
    activeGradientWidget.setValue(stops, currentOptions);
    
    // Make sure the node is redrawn
    if (currentOptions.node) {
      currentOptions.node.setDirtyCanvas(true, true);
    }
  }
  pendingUpdate = false;
}

// Hide the global color input
function hideGlobalColorInput() {
  // Apply any pending changes before hiding
  if (pendingUpdate && globalColorInput && activeGradientWidget && currentOptions && activeStopIndex !== -1) {
    applyColorChange();
  }
  
  // Force one last redraw
  if (currentOptions?.node) {
    currentOptions.node.setDirtyCanvas(true, true);
  }
  
  if (globalColorInput) {
    globalColorInput.style.left = "-9999px";
    globalColorInput.style.top = "-9999px";
  }
  
  // Cancel any pending animation frame
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  
  // Check if we're just closing the color picker after a color change
  // or if we're actually clearing selection
  const justChangedColor = 
    globalColorInput && 
    activeGradientWidget && 
    currentOptions && 
    activeStopIndex !== -1;
    
  pendingUpdate = false;
  
  // Only reset all state when we're completely closing interaction,
  // not when we just changed a color
  if (!justChangedColor) {
    activeGradientWidget = null;
    activeStopIndex = -1;
    currentOptions = null;
  }
}

export class GradientWidget extends BaseWidget implements IGradientWidget {
  declare type: "gradient";
  declare value: IWidgetGradientStop[];
  declare options: IWidgetGradientOptions;
  
  // Add computed height property
  computedHeight?: number;

  // State variables
  private selectedStopIndex: number = -1;
  private currentMixingAlgorithm: MixingAlgorithm = 'RGB';
  
  // Stored areas for interaction
  private gradientRect: { x: number, y: number, width: number, height: number } = { x: 0, y: 0, width: 0, height: 0 };
  private stopAreaRect: { x: number, y: number, width: number, height: number } = { x: 0, y: 0, width: 0, height: 0 };
  private algorithmLabelRect: { x: number, y: number, width: number, height: number } = { x: 0, y: 0, width: 0, height: 0 };
  
  /**
   * Compute the layout size of the widget.
   * @returns The layout size of the widget.
   */
  computeLayoutSize(): {
    minHeight: number
    maxHeight?: number
    minWidth: number
    maxWidth?: number
  } {
    // Calculate minimum height based on our fixed dimensions
    const totalHeight = 12 + // label
                     5 +  // first spacing
                     26 + // gradient
                     5 +  // second spacing
                     10;  // stop area
    return {
      minHeight: totalHeight,
      maxHeight: totalHeight, // Set max height equal to min height to keep it fixed
      minWidth: 20,
      maxWidth: 1_000_000,
    }
  }

  get height(): number {
    return this.computedHeight || super.height;
  }

  constructor(widget: IGradientWidget) {
    super(widget);
    this.type = "gradient";
    
    // Ensure we have at least two stops by default
    if (!widget.value || widget.value.length < 2) {
      this.value = [
        { position: 0, color: "#ffffff" },
        { position: 1, color: "#000000" }
      ];
    } else {
      this.value = widget.value;
    }
    
    this.options = widget.options || { };
  }
  
  /**
   * Draws the widget
   * @param ctx The canvas context
   * @param options The options for drawing the widget
   */
  override drawWidget(ctx: CanvasRenderingContext2D, {
    y,
    width,
    show_text = true,
    margin = 15,
  }: DrawWidgetOptions) {
    console.log("drawWidget");
    
    // Store original context attributes
    const originalTextAlign = ctx.textAlign;
    const originalStrokeStyle = ctx.strokeStyle;
    const originalFillStyle = ctx.fillStyle;
    const originalLineWidth = ctx.lineWidth;
    
    const { height } = this;
    const stopSize = 14;
    const halfStopSize = stopSize / 2;
    
    // Constants for layout - using fixed sizes instead of percentages
    const labelHeight = 12; // Fixed height for label
    const gradientHeight = 26; // Fixed height for gradient
    const stopAreaHeight = 10; // Fixed height for stop area
    const spacing = 5; // Spacing between elements
    
    const gradientY = y + labelHeight + spacing;
    const stopAreaY = gradientY + gradientHeight + spacing;
    
    // Store areas for interaction
    this.gradientRect = {
      x: margin,
      y: gradientY,
      width: width - margin * 2,
      height: gradientHeight
    };
    
    this.stopAreaRect = {
      x: margin,
      y: stopAreaY,
      width: width - margin * 2,
      height: stopAreaHeight
    };
    
    // Draw gradient container with border
    ctx.fillStyle = this.background_color;
    ctx.lineWidth = 1;
    ctx.strokeStyle = this.outline_color;
    ctx.fillRect(this.gradientRect.x, this.gradientRect.y, this.gradientRect.width, this.gradientRect.height);
    ctx.strokeRect(this.gradientRect.x, this.gradientRect.y, this.gradientRect.width, this.gradientRect.height);
    
    // Draw the actual gradient
    if (this.value.length >= 2) {
      // Sort stops by position
      const sortedStops = [...this.value].sort((a, b) => a.position - b.position);
      
      if (this.currentMixingAlgorithm === 'RGB') {
        // Use canvas gradient for RGB (more efficient)
        const gradient = ctx.createLinearGradient(
          this.gradientRect.x, 
          this.gradientRect.y, 
          this.gradientRect.x + this.gradientRect.width, 
          this.gradientRect.y
        );
        
        // Add color stops
        for (const stop of sortedStops) {
          gradient.addColorStop(stop.position, stop.color);
        }
        
        ctx.fillStyle = gradient;
        ctx.fillRect(this.gradientRect.x, this.gradientRect.y, this.gradientRect.width, this.gradientRect.height);
      } else {
        // For Oklab and CIELAB, we manually sample colors at small intervals for accurate representation
        const pixelWidth = 1; // Width of each sampled color
        const numSamples = Math.floor(this.gradientRect.width / pixelWidth);
        
        for (let i = 0; i < numSamples; i++) {
          const position = i / (numSamples - 1);
          const x = this.gradientRect.x + i * pixelWidth;
          
          // Get color at this position using our advanced color mixing
          const color = this.getColorAtPosition(position);
          
          ctx.fillStyle = color;
          ctx.fillRect(x, this.gradientRect.y, pixelWidth + 1, this.gradientRect.height);
        }
      }
    }
    
    // Draw track in the middle of the stop area
    const trackY = this.stopAreaRect.y + this.stopAreaRect.height / 2;
    
    // Draw stop markers
    for (let i = 0; i < this.value.length; i++) {
      const stop = this.value[i];
      const isSelected = i === this.selectedStopIndex;
      
      // Calculate stop position
      const stopX = this.stopAreaRect.x + stop.position * this.stopAreaRect.width;
      const stopY = trackY;
      
      // Draw stop marker
      ctx.beginPath();
      ctx.fillStyle = stop.color;
      
      // Draw diamond-shaped marker
      ctx.moveTo(stopX, stopY - halfStopSize);
      ctx.lineTo(stopX + halfStopSize, stopY);
      ctx.lineTo(stopX, stopY + halfStopSize);
      ctx.lineTo(stopX - halfStopSize, stopY);
      
      ctx.closePath();
      ctx.fill();
      
      // Draw border - yellow for selected, black otherwise
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.strokeStyle = isSelected ? "#ff9900" : "#000000";
      ctx.stroke();
    }
    
    // Draw label
    if (show_text) {
      ctx.fillStyle = this.secondary_text_color;
      ctx.textAlign = "left";
      const label = this.label || this.name;
      if (label != null) {
        ctx.fillText(label, margin, y + 10 );
      }
    }

    // Draw Mixing Algorithm
    ctx.fillStyle = this.text_color;
    ctx.textAlign = "right";
    
    // Store the algorithm label area for click detection
    const labelText = this.currentMixingAlgorithm;
    const labelMetrics = ctx.measureText(labelText);
    this.algorithmLabelRect = {
      x: width - margin - labelMetrics.width,
      y: y,
      width: labelMetrics.width,
      height: 12
    };
    
    ctx.fillText(labelText, width - margin, y + 10);
    
    // Restore original context attributes
    ctx.textAlign = originalTextAlign;
    ctx.strokeStyle = originalStrokeStyle;
    ctx.fillStyle = originalFillStyle;
    ctx.lineWidth = originalLineWidth;
  }
  
  /**
   * Checks if a point is over a gradient stop
   */
  private getStopAtPosition(x: number, y: number): number {
    console.log("getStopAtPosition");
    
    const stopSize = 14;
    const hitArea = stopSize * 1.5; // Make the hit area larger than the visual size
      
    // Calculate track position
    const trackY = this.gradientRect.y + this.gradientRect.height + 6; // Track is below
      
    for (let i = 0; i < this.value.length; i++) {
      const stop = this.value[i];
      
      // Calculate stop position
      const stopX = this.gradientRect.x + stop.position * this.gradientRect.width;
      const stopY = trackY;
      
      // Check if point is within the stop marker
      if (Math.abs(x - stopX) <= hitArea / 2 && Math.abs(y - stopY) <= hitArea / 2) {
        return i;
      }
    }
    
    return -1;
  }
  
  /**
   * Check if point is within the gradient rect
   */
  private isOverGradient(x: number, y: number): boolean {
    console.log("isOverGradient");
    
    return (
      x >= this.gradientRect.x && 
      x <= this.gradientRect.x + this.gradientRect.width && 
      y >= this.gradientRect.y && 
      y <= this.gradientRect.y + this.gradientRect.height
    );
  }

  /**
   * Get normalized position (0-1) from x, y coordinates
   */
  private getNormalizedPosition(x: number, y: number): number {
    return Math.max(0, Math.min(1, (x - this.gradientRect.x) / this.gradientRect.width));
  }
  
  /**
   * Add a new gradient stop
   */
  private addStop(position: number, color: string, options: {
    e: CanvasMouseEvent,
    node: LGraphNode,
    canvas: LGraphCanvas
  }): number {
    const minStops = this.options.min_stops || 2;
    
    // Create new stops array with the new stop
    const newStops = [...this.value, { position, color }];
    
    // Sort by position
    newStops.sort((a, b) => a.position - b.position);
    
    // Find the index of our new stop
    const newStopIndex = newStops.findIndex(s => s.position === position && s.color === color);
    
    // Update the value
    this.setValue(newStops, options);
    
    return newStopIndex;
  }
  
  
  /**
   * Handle click events
   */
  override onClick(options: {
    e: CanvasMouseEvent
    node: LGraphNode
    canvas: LGraphCanvas
  }) {
    console.log("onClick");
    if (this.options.read_only) return;

    const { e, node, canvas } = options;
    const x = e.canvasX - node.pos[0];
    const y = e.canvasY - node.pos[1];
    
    // Check if clicking on algorithm label
    if (this.isOverAlgorithmLabel(x, y)) {
      // Cycle to next algorithm
      const currentIndex = MIXING_ALGORITHMS.indexOf(this.currentMixingAlgorithm);
      this.currentMixingAlgorithm = MIXING_ALGORITHMS[(currentIndex + 1) % MIXING_ALGORITHMS.length];
      
      // Force a gradient recalculation by triggering setValue with the same values
      this.setValue([...this.value], options);
      
      // Redraw
      node.setDirtyCanvas(true, true);
      return true;
    }
    
    // Check if clicking on a stop
    const clickedStopIndex = this.getStopAtPosition(x, y);
    if (clickedStopIndex !== -1) {
      // If clicking the already selected/active stop, open color picker
      if (clickedStopIndex === activeStopIndex) {
        this.openColorPicker(clickedStopIndex, options);
      } else {
        // Select this stop - update both internal and global selection
        this.selectedStopIndex = clickedStopIndex;
        activeStopIndex = clickedStopIndex;
      }
      return true;
    }
    
    // Check if clicking on the gradient
    if (this.isOverGradient(x, y)) {
      console.log("onclick isOverGradient true");
      
      // Add a new stop
      const position = this.getNormalizedPosition(x, y);
      const color = this.getColorAtPosition(position);
      
      // Add the stop and select it
      const newStopIndex = this.addStop(position, color, options);
      if (newStopIndex !== -1) {
        // Update both internal and global selection
        this.selectedStopIndex = newStopIndex;
        activeStopIndex = newStopIndex;
        
        // Immediately open the color picker for the new stop
        this.openColorPicker(newStopIndex, options);
      }
      
      return true;
    }
    
    // Clicking elsewhere deselects
    if (activeStopIndex !== -1 || this.selectedStopIndex !== -1) {
      this.selectedStopIndex = -1;
      activeStopIndex = -1;
      return true;
    }
    
    return false;
  }
  
  /**
   * Handle drag events - update the position using the mouse event
   */
  override onDrag(options: {
    e: CanvasMouseEvent
    node: LGraphNode
    canvas: LGraphCanvas
  }) {
    if (this.options.read_only) return false;
    
    const { e, node, canvas } = options;
    const x = e.canvasX - node.pos[0];
    const y = e.canvasY - node.pos[1];
    
    // Only drag if the internal selection matches the global activeStopIndex
    // This prevents dragging stops that aren't visually selected with yellow outline
    if (this.selectedStopIndex !== -1 && this.selectedStopIndex === activeStopIndex) {
      // Check if dragging far enough down to delete the stop
      const deleteThreshold = this.stopAreaRect.y + this.stopAreaRect.height + 50;
      if (y > deleteThreshold && this.value.length > 2) {
        // Remove the stop
        const newStops = [...this.value];
        newStops.splice(this.selectedStopIndex, 1);
        
        // Update the value
        this.setValue(newStops, options);
        
        // Clear selection
        this.selectedStopIndex = -1;
        activeStopIndex = -1;
        
        // Release capture
        node.captureInput(false);
        
        return true;
      }
      
      // Otherwise, update position of selected stop horizontally
      const position = this.getNormalizedPosition(x, y);
      
      // Create new stops array with updated position
      const newStops = [...this.value];
      newStops[this.selectedStopIndex].position = position;
      
      // Update the value
      this.setValue(newStops, options);
      
      return true;
    }
    
    return false;
  }
  
  /**
   * Calculate the color at a specific position in the gradient
   */
  private getColorAtPosition(position: number): string {
    if (this.value.length === 0) return "#ffffff";
    if (this.value.length === 1) return this.value[0].color;
    
    // Sort stops by position
    const sortedStops = [...this.value].sort((a, b) => a.position - b.position);
    
    // If position is outside the range, return edge colors
    if (position <= sortedStops[0].position) return sortedStops[0].color;
    if (position >= sortedStops[sortedStops.length - 1].position) return sortedStops[sortedStops.length - 1].color;
    
    // Find the two stops we're between
    let lower = sortedStops[0];
    let upper = sortedStops[sortedStops.length - 1];
    
    for (let i = 0; i < sortedStops.length - 1; i++) {
      if (position >= sortedStops[i].position && position <= sortedStops[i + 1].position) {
        lower = sortedStops[i];
        upper = sortedStops[i + 1];
        break;
      }
    }
    
    // Calculate the color using the current mixing algorithm
    return this.interpolateColor(lower.color, upper.color, (position - lower.position) / (upper.position - lower.position));
  }
  
  /**
   * Linear interpolation between two colors using the current mixing algorithm
   */
  private interpolateColor(color1: string, color2: string, factor: number): string {
    // Convert hex to rgb
    const r1 = parseInt(color1.substr(1, 2), 16);
    const g1 = parseInt(color1.substr(3, 2), 16);
    const b1 = parseInt(color1.substr(5, 2), 16);
    
    const r2 = parseInt(color2.substr(1, 2), 16);
    const g2 = parseInt(color2.substr(3, 2), 16);
    const b2 = parseInt(color2.substr(5, 2), 16);

    let r: number, g: number, b: number;
    
    switch (this.currentMixingAlgorithm) {
      case 'Oklab': {
        const [l1, a1, b1_] = this.rgbToOklab(r1, g1, b1);
        const [l2, a2, b2_] = this.rgbToOklab(r2, g2, b2);
        
        const l = l1 + factor * (l2 - l1);
        const a = a1 + factor * (a2 - a1);
        const b_ = b1_ + factor * (b2_ - b1_);
        
        [r, g, b] = this.oklabToRgb(l, a, b_);
        break;
      }
      case 'CIELAB': {
        const [l1, a1, b1_] = this.rgbToCIELAB(r1, g1, b1);
        const [l2, a2, b2_] = this.rgbToCIELAB(r2, g2, b2);
        
        const l = l1 + factor * (l2 - l1);
        const a = a1 + factor * (a2 - a1);
        const b_ = b1_ + factor * (b2_ - b1_);
        
        [r, g, b] = this.cielabToRgb(l, a, b_);
        break;
      }
      default: { // RGB
        r = Math.round(r1 + factor * (r2 - r1));
        g = Math.round(g1 + factor * (g2 - g1));
        b = Math.round(b1 + factor * (b2 - b1));
      }
    }
    
    // Convert back to hex
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
  
  /**
   * Open the color picker for a stop
   */
  private openColorPicker(stopIndex: number, options: {
    e: CanvasMouseEvent
    node: LGraphNode
    canvas: LGraphCanvas
  }) {
    const { e } = options;
    
    // Set active widget and stop for callbacks
    activeGradientWidget = this;
    activeStopIndex = stopIndex;
    currentOptions = options;
    
    // Get and position color input
    const colorInput = getGlobalColorInput();
    
    // Set the current color before positioning
    colorInput.value = this.value[stopIndex].color;
    
    // Position where the mouse is
    colorInput.style.left = `${e.clientX}px`;
    colorInput.style.top = `${e.clientY}px`;
    
    // Reset pending update state
    pendingUpdate = false;
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    
    // Make the input active for the click
    colorInput.style.pointerEvents = "auto";
    
    // Focus and click the input to open the color picker
    setTimeout(() => {
      colorInput.focus();
      colorInput.click();
      
      // After opening, disable pointer events
      setTimeout(() => {
        if (globalColorInput) {
          globalColorInput.style.pointerEvents = "none";
        }
      }, 100);
    }, 10);
  }

  /**
   * Check if point is over the algorithm label
   */
  private isOverAlgorithmLabel(x: number, y: number): boolean {
    return (
      x >= this.algorithmLabelRect.x && 
      x <= this.algorithmLabelRect.x + this.algorithmLabelRect.width && 
      y >= this.algorithmLabelRect.y && 
      y <= this.algorithmLabelRect.y + this.algorithmLabelRect.height
    );
  }

  /**
   * Convert RGB to Oklab
   */
  private rgbToOklab(r: number, g: number, b: number): [number, number, number] {
    // Convert RGB [0,1] to linear RGB
    r = Math.pow(r / 255, 2.2);
    g = Math.pow(g / 255, 2.2);
    b = Math.pow(b / 255, 2.2);

    // Convert to Oklab
    const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
    const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
    const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

    const l_ = Math.cbrt(l);
    const m_ = Math.cbrt(m);
    const s_ = Math.cbrt(s);

    return [
      0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
      1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
      0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
    ];
  }

  /**
   * Convert Oklab to RGB
   */
  private oklabToRgb(L: number, a: number, b: number): [number, number, number] {
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;

    let r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    let b_ = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

    // Convert to sRGB and clamp
    r = Math.min(255, Math.max(0, Math.round(Math.pow(r, 1/2.2) * 255)));
    g = Math.min(255, Math.max(0, Math.round(Math.pow(g, 1/2.2) * 255)));
    b_ = Math.min(255, Math.max(0, Math.round(Math.pow(b_, 1/2.2) * 255)));

    return [r, g, b_];
  }

  /**
   * Convert RGB to CIELAB
   */
  private rgbToCIELAB(r: number, g: number, b: number): [number, number, number] {
    // Convert RGB to XYZ
    r = r / 255;
    g = g / 255;
    b = b / 255;

    // Convert to linear RGB
    r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

    // Convert to XYZ
    const x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
    const y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
    const z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041;

    // Convert XYZ to Lab
    const xn = 0.95047;
    const yn = 1.0;
    const zn = 1.08883;

    const fx = x / xn > 0.008856 ? Math.pow(x / xn, 1/3) : (7.787 * x / xn) + 16/116;
    const fy = y / yn > 0.008856 ? Math.pow(y / yn, 1/3) : (7.787 * y / yn) + 16/116;
    const fz = z / zn > 0.008856 ? Math.pow(z / zn, 1/3) : (7.787 * z / zn) + 16/116;

    const L = (116 * fy) - 16;
    const a = 500 * (fx - fy);
    const b_ = 200 * (fy - fz);

    return [L, a, b_];
  }

  /**
   * Convert CIELAB to RGB
   */
  private cielabToRgb(L: number, a: number, b: number): [number, number, number] {
    // Convert Lab to XYZ
    const y = (L + 16) / 116;
    const x = a / 500 + y;
    const z = y - b / 200;

    const xn = 0.95047;
    const yn = 1.0;
    const zn = 1.08883;

    const x3 = Math.pow(x, 3);
    const y3 = Math.pow(y, 3);
    const z3 = Math.pow(z, 3);

    const xr = x3 > 0.008856 ? x3 : (x - 16/116) / 7.787;
    const yr = y3 > 0.008856 ? y3 : (y - 16/116) / 7.787;
    const zr = z3 > 0.008856 ? z3 : (z - 16/116) / 7.787;

    const X = xr * xn;
    const Y = yr * yn;
    const Z = zr * zn;

    // Convert XYZ to RGB
    let r = X * 3.2404542 - Y * 1.5371385 - Z * 0.4985314;
    let g = -X * 0.9692660 + Y * 1.8760108 + Z * 0.0415560;
    let b_ = X * 0.0556434 - Y * 0.2040259 + Z * 1.0572252;

    // Convert to sRGB
    r = r > 0.0031308 ? 1.055 * Math.pow(r, 1/2.4) - 0.055 : 12.92 * r;
    g = g > 0.0031308 ? 1.055 * Math.pow(g, 1/2.4) - 0.055 : 12.92 * g;
    b_ = b_ > 0.0031308 ? 1.055 * Math.pow(b_, 1/2.4) - 0.055 : 12.92 * b_;

    // Convert to RGB [0-255] and clamp
    r = Math.min(255, Math.max(0, Math.round(r * 255)));
    g = Math.min(255, Math.max(0, Math.round(g * 255)));
    b_ = Math.min(255, Math.max(0, Math.round(b_ * 255)));

    return [r, g, b_];
  }
} 