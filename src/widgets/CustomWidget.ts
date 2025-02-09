import type { ICustomWidget } from "@/types/widgets"
import type { LGraphNode } from "@/litegraph"
import { BaseWidget } from "./BaseWidget"

export class CustomWidget extends BaseWidget implements ICustomWidget<HTMLElement> {
  declare value: string | object

  constructor(widget: ICustomWidget<HTMLElement>) {
    super(widget)
    this.value = widget.value
  }

  drawWidget(ctx: CanvasRenderingContext2D, options: {
    y: number
    width: number
    node: LGraphNode
    show_text?: boolean
    margin?: number
  }): void {
    this.draw?.(ctx, options.node, options.width, options.y, this.height)
  }
}
