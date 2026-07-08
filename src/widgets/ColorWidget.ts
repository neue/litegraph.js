import type { LGraphNode } from "@/LGraphNode"
import type { IColorWidget, IWidgetOptions } from "@/types/widgets"

import { BaseWidget, type DrawWidgetOptions, type WidgetEventOptions } from "./BaseWidget"

// Global singleton color input element
let globalColorInput: HTMLInputElement | null = null
let currentColorWidget: ColorWidget | null = null
let currentOptions: WidgetEventOptions | null = null
let pendingUpdate = false
let animationFrameId: number | null = null

// Create and get the global color input
function getGlobalColorInput(): HTMLInputElement {
  if (!globalColorInput) {
    globalColorInput = document.createElement("input")
    globalColorInput.type = "color"
    globalColorInput.style.position = "absolute"
    globalColorInput.style.width = "0"
    globalColorInput.style.height = "0"
    globalColorInput.style.padding = "0"
    globalColorInput.style.border = "none"
    globalColorInput.style.opacity = "0"
    globalColorInput.style.pointerEvents = "none"
    globalColorInput.style.zIndex = "10000"
    document.body.append(globalColorInput)

    // Handle color changes
    globalColorInput.addEventListener("input", handleColorChange)
    // Handle blur for cleanup
    globalColorInput.addEventListener("blur", hideGlobalColorInput)
    // Handle change for final value
    globalColorInput.addEventListener("change", () => {
      // Always apply the final value immediately
      if (globalColorInput && currentColorWidget && currentOptions) {
        applyColorChange()
      }
      setTimeout(hideGlobalColorInput, 100)
    })
  }
  return globalColorInput
}

// Schedule a color update for next animation frame
function handleColorChange() {
  if (!globalColorInput || !currentColorWidget || !currentOptions) return

  // Skip if value hasn't changed
  if (globalColorInput.value === currentColorWidget.value) return

  // If we don't have a pending update, schedule one for the next frame
  if (!pendingUpdate) {
    pendingUpdate = true

    // Cancel any existing animation frame request
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
    }

    // Schedule the update for the next animation frame
    animationFrameId = requestAnimationFrame(() => {
      applyColorChange()
      pendingUpdate = false
      animationFrameId = null
    })
  }
}

// Apply the current color change
function applyColorChange() {
  if (globalColorInput && currentColorWidget && currentOptions) {
    currentColorWidget.setValue(globalColorInput.value, currentOptions)
  }
}

// Hide the global color input
function hideGlobalColorInput() {
  if (globalColorInput) {
    globalColorInput.style.left = "-9999px"
    globalColorInput.style.top = "-9999px"
  }

  // Cancel any pending animation frame
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }

  pendingUpdate = false
  currentColorWidget = null
  currentOptions = null
}

/**
 * Fork addition: a colour swatch widget that opens the native colour picker
 * (via a hidden singleton `<input type="color">`).
 */
export class ColorWidget extends BaseWidget<IColorWidget> implements IColorWidget {
  declare type: "color"
  declare options: IWidgetOptions<string>

  constructor(widget: IColorWidget, node?: LGraphNode) {
    super(widget, node as LGraphNode)
    this.type = "color"
    this.value = widget.value || "#ffffff"
  }

  override drawWidget(ctx: CanvasRenderingContext2D, { width, showText = true }: DrawWidgetOptions) {
    // Store original context attributes
    const originalTextAlign = ctx.textAlign
    const originalStrokeStyle = ctx.strokeStyle
    const originalFillStyle = ctx.fillStyle

    const { height, y } = this
    const { margin } = BaseWidget

    if (showText) {
      // Draw color swatch on the right side
      ctx.save()
      ctx.fillStyle = this.value
      const swatchSize = height - 6
      const swatchX = width - margin - swatchSize - 5
      const swatchY = y + 3
      ctx.beginPath()
      ctx.roundRect(swatchX, swatchY, swatchSize, swatchSize, [4])
      ctx.fill()

      // Draw a border around the swatch for better visibility
      ctx.strokeStyle = "#000000"
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.restore()

      // Draw label
      ctx.textAlign = "left"
      ctx.fillStyle = this.secondary_text_color
      const label = this.displayName
      if (label != null) {
        ctx.fillText(label, margin * 2, y + height * 0.7)
      }

      // Draw value
      ctx.fillStyle = this.text_color
      ctx.textAlign = "right"
      ctx.fillText(this.value, swatchX - 5, y + height * 0.7)
    }

    // Restore original context attributes
    ctx.textAlign = originalTextAlign
    ctx.strokeStyle = originalStrokeStyle
    ctx.fillStyle = originalFillStyle
  }

  override onClick(options: WidgetEventOptions) {
    if (this.options.read_only) return

    const { e } = options

    // Get the color input
    const colorInput = getGlobalColorInput()

    // Set current widget and options for callbacks
    currentColorWidget = this
    currentOptions = options

    // Set the current color
    colorInput.value = this.value

    // Reset any pending updates
    pendingUpdate = false
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }

    // Position where the mouse is
    colorInput.style.left = `${e.clientX}px`
    colorInput.style.top = `${e.clientY}px`

    // Make the input active for the click
    colorInput.style.pointerEvents = "auto"

    // Focus and click the input to open the color picker
    setTimeout(() => {
      colorInput.focus()
      colorInput.click()

      // After a small delay to let the color picker open, disable pointer events
      // This prevents the input from blocking other interactions
      setTimeout(() => {
        if (globalColorInput) {
          globalColorInput.style.pointerEvents = "none"
        }
      }, 100)
    }, 10)
  }
}
