import type { CanvasPointer, LGraphCanvas, LGraphNode } from "../litegraph"
import type { CanvasMouseEvent, CanvasPointerEvent } from "./events"

import { CanvasColour, Point, Size } from "../interfaces"

export interface IWidgetOptions<TValue = unknown> extends Record<string, unknown> {
  on?: string
  off?: string
  max?: number
  min?: number
  slider_color?: CanvasColour
  marker_color?: CanvasColour
  precision?: number
  read_only?: boolean
  /**
   * @deprecated Use {@link IWidgetOptions.step2} instead.
   * The legacy step is scaled up by 10x in the legacy frontend logic.
   */
  step?: number
  /** The step value for numeric widgets. */
  step2?: number

  y?: number
  multiline?: boolean
  // TODO: Confirm this
  property?: string

  values?: TValue[]
  callback?: IWidget["callback"]
}

export interface IWidgetSliderOptions extends IWidgetOptions<number> {
  min: number
  max: number
  step2: number
  slider_color?: CanvasColour
  marker_color?: CanvasColour
}

export interface IWidgetKnobOptions extends IWidgetOptions<number> {
  min: number
  max: number
  step2: number
  slider_color?: CanvasColour // TODO: Replace with knob color
  marker_color?: CanvasColour
  gradient_stops?: string
}

/**
 * A widget for a node.
 * All types are based on IBaseWidget - additions can be made there or directly on individual types.
 *
 * Implemented as a discriminative union of widget types, so this type itself cannot be extended.
 * Recommend declaration merging any properties that use IWidget (e.g. {@link LGraphNode.widgets}) with a new type alias.
 * @see ICustomWidget
 */
export type IWidget =
  | IBooleanWidget
  | INumericWidget
  | IStringWidget
  | IMultilineStringWidget
  | IComboWidget
  | ICustomWidget
  | ISliderWidget
  | IButtonWidget
  | IKnobWidget
  | IColorWidget
  | IGradientWidget

export interface IBooleanWidget extends IBaseWidget {
  type: "toggle"
  value: boolean
}

/** Any widget that uses a numeric backing */
export interface INumericWidget extends IBaseWidget {
  type: "number"
  value: number
}

export interface ISliderWidget extends IBaseWidget {
  type: "slider"
  value: number
  options: IWidgetSliderOptions
  marker?: number
}

export interface IKnobWidget extends IBaseWidget {
  type: "knob"
  value: number
  options: IWidgetKnobOptions
}

/** A combo-box widget (dropdown, select, etc) */
export interface IComboWidget extends IBaseWidget {
  type: "combo"
  value: string | number
  options: IWidgetOptions<string>
}

export type IStringWidgetType = IStringWidget["type"] | IMultilineStringWidget["type"]

/** A widget with a string value */
export interface IStringWidget extends IBaseWidget {
  type: "string" | "text"
  value: string
}

export interface IButtonWidget extends IBaseWidget {
  type: "button"
  value: undefined
  clicked: boolean
}

/** A widget with a string value and a multiline text input */
export interface IMultilineStringWidget<TElement extends HTMLElement = HTMLTextAreaElement> extends
  IBaseWidget {

  type: "multiline"
  value: string

  /** HTML textarea element  */
  element?: TElement
}

/** A custom widget - accepts any value and has no built-in special handling */
export interface ICustomWidget extends IBaseWidget {
  type: "custom"
  value: string | object
}

/** A color picker widget */
export interface IColorWidget extends IBaseWidget {
  type: "color"
  value: string
  options: IWidgetOptions<string>
}

/**
 * Valid widget types.  TS cannot provide easily extensible type safety for this at present.
 * Override linkedWidgets[]
 * Values not in this list will not result in litegraph errors, however they will be treated the same as "custom".
 */
export type TWidgetType = IWidget["type"]
export type TWidgetValue = IWidget["value"]

/**
 * The base type for all widgets.  Should not be implemented directly.
 * @see IWidget
 */
export interface IBaseWidget {
  linkedWidgets?: IWidget[]

  name: string
  options: IWidgetOptions

  label?: string
  /** Widget type (see {@link TWidgetType}) */
  type: TWidgetType
  value?: TWidgetValue

  /**
   * The computed height of the widget. Used by customized node resize logic.
   * See scripts/domWidget.ts for more details.
   */
  computedHeight?: number

  /**
   * The starting y position of the widget after layout.
   */
  y: number

  /**
   * The y position of the widget after drawing (rendering).
   * @deprecated There is no longer dynamic y adjustment on rendering anymore.
   * Use {@link IBaseWidget.y} instead.
   */
  last_y?: number

  width?: number
  disabled?: boolean

  hidden?: boolean
  advanced?: boolean

  tooltip?: string

  // TODO: Confirm this format
  callback?(
    value: any,
    canvas?: LGraphCanvas,
    node?: LGraphNode,
    pos?: Point,
    e?: CanvasMouseEvent,
  ): void

  /**
   * Simple callback for pointer events, allowing custom widgets to events relevant to them.
   * @param event The pointer event that triggered this callback
   * @param pointerOffset Offset of the pointer relative to {@link node.pos}
   * @param node The node this widget belongs to
   * @todo Expose CanvasPointer API to custom widgets
   */
  mouse?(event: CanvasPointerEvent, pointerOffset: Point, node: LGraphNode): boolean
  /**
   * Draw the widget.
   * @param ctx The canvas context to draw on.
   * @param node The node this widget belongs to.
   * @param widget_width The width of the widget.
   * @param y The y position of the widget.
   * @param H The height of the widget.
   * @param lowQuality Whether to draw the widget in low quality.
   */
  draw?(
    ctx: CanvasRenderingContext2D,
    node: LGraphNode,
    widget_width: number,
    y: number,
    H: number,
    lowQuality?: boolean,
  ): void

  /**
   * Compute the size of the widget. Overrides {@link IBaseWidget.computeSize}.
   * @param width The width of the widget.
   * @deprecated Use {@link IBaseWidget.computeLayoutSize} instead.
   * @returns The size of the widget.
   */
  computeSize?(width?: number): Size

  /**
   * Compute the layout size of the widget.
   * @param node The node this widget belongs to.
   * @returns The layout size of the widget.
   */
  computeLayoutSize?: (
    this: IBaseWidget,
    node: LGraphNode
  ) => {
    minHeight: number
    maxHeight?: number
    minWidth: number
    maxWidth?: number
  }

  /**
   * Callback for pointerdown events, allowing custom widgets to register callbacks to occur
   * for all {@link CanvasPointer} events.
   *
   * This callback is operated early in the pointerdown logic; actions that prevent it from firing are:
   * - `Ctrl + Drag` Multi-select
   * - `Alt + Click/Drag` Clone node
   * @param pointer The CanvasPointer handling this event
   * @param node The node this widget belongs to
   * @param canvas The LGraphCanvas where this event originated
   * @returns Returning `true` from this callback forces Litegraph to ignore the event and
   * not process it any further.
   */
  onPointerDown?(pointer: CanvasPointer, node: LGraphNode, canvas: LGraphCanvas): boolean
}

export interface IWidgetGradientStop {
  position: number; // 0 to 1
  color: string;    // Color in hex format
}

export interface IWidgetGradientOptions extends IWidgetOptions<IWidgetGradientStop[]> {
  vertical?: boolean;         // Whether the gradient is vertical or horizontal
  background_color?: string;  // Background color for the gradient editor
  border_color?: string;      // Border color for the gradient editor
  min_stops?: number;         // Minimum number of stops (default: 2)
  max_stops?: number;         // Maximum number of stops (default: 10)
  stop_size?: number;         // Size of the stop markers in pixels
}

export interface IGradientWidget extends IBaseWidget {
  type: "gradient";
  value: IWidgetGradientStop[];
  options: IWidgetGradientOptions;
}
