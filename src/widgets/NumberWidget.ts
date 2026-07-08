import type { DrawWidgetOptions, WidgetEventOptions } from "./BaseWidget"
import type { INumericWidget } from "@/types/widgets"

import { getWidgetStep } from "@/utils/widget"

import { BaseSteppedWidget } from "./BaseSteppedWidget"

export class NumberWidget extends BaseSteppedWidget<INumericWidget> implements INumericWidget {
  override type = "number" as const

  override get _displayValue() {
    if (this.computedDisabled) return ""
    // Fork addition: when options.round is set, display exactly the decimal
    // places the rounding step implies (e.g. round 0.05 -> 2 dp, round 1 -> 0 dp)
    const { round, precision } = this.options
    let decimals = precision !== undefined ? precision : 3
    if (round) {
      const fraction = String(round).split(".")[1]
      decimals = fraction ? fraction.length : 0
    }
    return Number(this.value).toFixed(decimals)
  }

  // Fork styling: no background capsule behind number widgets — arrows and
  // text drawn directly on the node
  override drawWidget(ctx: CanvasRenderingContext2D, options: DrawWidgetOptions) {
    // Store original context attributes
    const { fillStyle, strokeStyle, textAlign } = ctx

    if (options.showText) {
      if (!this.computedDisabled) this.drawArrowButtons(ctx, options.width)

      this.drawTruncatingText({ ctx, width: options.width })
    }

    // Restore original context attributes
    Object.assign(ctx, { textAlign, strokeStyle, fillStyle })
  }

  override canIncrement(): boolean {
    const { max } = this.options
    return max == null || this.value < max
  }

  override canDecrement(): boolean {
    const { min } = this.options
    return min == null || this.value > min
  }

  override incrementValue(options: WidgetEventOptions): void {
    this.setValue(this.value + getWidgetStep(this.options), options)
  }

  override decrementValue(options: WidgetEventOptions): void {
    this.setValue(this.value - getWidgetStep(this.options), options)
  }

  override setValue(value: number, options: WidgetEventOptions) {
    let newValue = value
    // Fork addition: snap to multiples of options.round before clamping
    if (this.options.round) {
      newValue = Math.round(newValue / this.options.round) * this.options.round
    }
    if (this.options.min != null && newValue < this.options.min) {
      newValue = this.options.min
    }
    if (this.options.max != null && newValue > this.options.max) {
      newValue = this.options.max
    }
    super.setValue(newValue, options)
  }

  override onClick({ e, node, canvas }: WidgetEventOptions) {
    const x = e.canvasX - node.pos[0]
    const width = this.width || node.size[0]

    // Determine if clicked on left/right arrows
    const delta = x < 40
      ? -1
      : (x > width - 40
        ? 1
        : 0)

    if (delta) {
      // Handle left/right arrow clicks
      this.setValue(this.value + delta * getWidgetStep(this.options), { e, node, canvas })
      return
    }

    // Handle center click - show prompt
    canvas.prompt("Value", this.value, (v: string) => {
      // Check if v is a valid equation or a number
      if (/^[\d\s()*+/-]+|\d+\.\d+$/.test(v)) {
        // Solve the equation if possible
        try {
          v = eval(v)
        } catch {}
      }
      const newValue = Number(v)
      if (!isNaN(newValue)) {
        this.setValue(newValue, { e, node, canvas })
      }
    }, e)
  }

  /**
   * Handles drag events for the number widget
   * @param options The options for handling the drag event
   */
  override onDrag({ e, node, canvas }: WidgetEventOptions) {
    const width = this.width || node.width
    const x = e.canvasX - node.pos[0]
    const delta = x < 40
      ? -1
      : (x > width - 40
        ? 1
        : 0)

    if (delta && (x > -3 && x < width + 3)) return
    this.setValue(this.value + (e.deltaX ?? 0) * getWidgetStep(this.options), { e, node, canvas })
  }
}
