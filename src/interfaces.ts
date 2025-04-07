import type { ContextMenu } from "./ContextMenu"
import type { LGraphNode, NodeId } from "./LGraphNode"
import type { LinkId, LLink } from "./LLink"
import type { Reroute, RerouteId } from "./Reroute"
import type { LinkDirection, RenderShape } from "./types/globalEnums"
import type { LayoutElement } from "./utils/layout"

export type Dictionary<T> = { [key: string]: T }

/** Allows all properties to be null.  The same as `Partial<T>`, but adds null instead of undefined. */
export type NullableProperties<T> = {
  [P in keyof T]: T[P] | null
}

/**
 * If {@link T} is `null` or `undefined`, evaluates to {@link Result}. Otherwise, evaluates to {@link T}.
 * Useful for functions that return e.g. `undefined` when a param is nullish.
 */
export type WhenNullish<T, Result> = T & {} | (T extends null ? Result : T extends undefined ? Result : T & {})

/** A type with each of the {@link Properties} made optional. */
export type OptionalProps<T, Properties extends keyof T> = Omit<T, Properties> & { [K in Properties]?: T[K] }

/** Bitwise AND intersection of two types; returns a new, non-union type that includes only properties that exist on both types. */
export type SharedIntersection<T1, T2> = {
  [P in keyof T1 as P extends keyof T2 ? P : never]: T1[P]
} & {
  [P in keyof T2 as P extends keyof T1 ? P : never]: T2[P]
}

export type CanvasColour = string | CanvasGradient | CanvasPattern

/** An object containing a set of child objects */
export interface Parent<TChild> {
  /** All objects owned by the parent object. */
  readonly children?: ReadonlySet<TChild>
}

/**
 * An object that can be positioned, selected, and moved.
 *
 * May contain other {@link Positionable} objects.
 */
export interface Positionable extends Parent<Positionable> {
  readonly id: NodeId | RerouteId | number
  /** Position in graph coordinates.  Default: 0,0 */
  readonly pos: Point
  /** true if this object is part of the selection, otherwise false. */
  selected?: boolean

  /** See {@link IPinnable.pinned} */
  readonly pinned?: boolean

  /**
   * Adds a delta to the current position.
   * @param deltaX X value to add to current position
   * @param deltaY Y value to add to current position
   * @param skipChildren If true, any child objects like group contents will not be moved
   */
  move(deltaX: number, deltaY: number, skipChildren?: boolean): void

  /**
   * Snaps this item to a grid.
   *
   * Position values are rounded to the nearest multiple of {@link snapTo}.
   * @param snapTo The size of the grid to align to
   * @returns `true` if it moved, or `false` if the snap was rejected (e.g. `pinned`)
   */
  snapToGrid(snapTo: number): boolean

  /**
   * Cached position & size as `x, y, width, height`.
   * @readonly
   * @see {@link move}
   */
  readonly boundingRect: ReadOnlyRect

  /** Called whenever the item is selected */
  onSelected?(): void
  /** Called whenever the item is deselected */
  onDeselected?(): void
}

/**
 * A color option to customize the color of {@link LGraphNode} or {@link LGraphGroup}.
 * @see {@link LGraphCanvas.node_colors}
 */
export interface ColorOption {
  color: string
  bgcolor: string
  groupcolor: string
}

/**
 * An object that can be colored with a {@link ColorOption}.
 */
export interface IColorable {
  setColorOption(colorOption: ColorOption | null): void
  getColorOption(): ColorOption | null
}

/**
 * An object that can be pinned.
 *
 * Prevents the object being accidentally moved or resized by mouse interaction.
 */
export interface IPinnable {
  readonly pinned: boolean
  pin(value?: boolean): void
  unpin(): void
}

export interface ReadonlyLinkNetwork {
  readonly links: ReadonlyMap<LinkId, LLink>
  readonly reroutes: ReadonlyMap<RerouteId, Reroute>
  readonly floatingLinks: ReadonlyMap<LinkId, LLink>
  getNodeById(id: NodeId | null | undefined): LGraphNode | null
  getReroute(parentId: null | undefined): undefined
  getReroute(parentId: RerouteId | null | undefined): Reroute | undefined
}

/**
 * Contains a list of links, reroutes, and nodes.
 */
export interface LinkNetwork extends ReadonlyLinkNetwork {
  readonly links: Map<LinkId, LLink>
  readonly reroutes: Map<RerouteId, Reroute>
  addFloatingLink(link: LLink): LLink
  removeReroute(id: number): unknown
  removeFloatingLink(link: LLink): void
}

/**
 * Locates graph items.
 */
export interface ItemLocator {
  getNodeOnPos(x: number, y: number, nodeList?: LGraphNode[]): LGraphNode | null
  getRerouteOnPos(x: number, y: number): Reroute | undefined
}

/** Contains a cached 2D canvas path and a centre point, with an optional forward angle. */
export interface LinkSegment {
  /** Link / reroute ID */
  readonly id: LinkId | RerouteId
  /** The {@link id} of the reroute that this segment starts from (output side), otherwise `undefined`.  */
  readonly parentId?: RerouteId

  /** The last canvas 2D path that was used to render this segment */
  path?: Path2D
  /** Centre point of the {@link path}.  Calculated during render only - can be inaccurate */
  readonly _pos: Float32Array
  /**
   * Y-forward along the {@link path} from its centre point, in radians.
   * `undefined` if using circles for link centres.
   * Calculated during render only - can be inaccurate.
   */
  _centreAngle?: number

  /** Whether the link is currently being moved. @internal */
  _dragging?: boolean

  /** Output node ID */
  readonly origin_id: NodeId | undefined
  /** Output slot index */
  readonly origin_slot: number | undefined
}

export interface IInputOrOutput {
  // If an input, this will be defined
  input?: INodeInputSlot | null
  // If an output, this will be defined
  output?: INodeOutputSlot | null
}

export interface IFoundSlot extends IInputOrOutput {
  // Slot index
  slot: number
  // Centre point of the rendered slot connection
  link_pos: Point
}

/** A point represented as `[x, y]` co-ordinates */
export type Point = [x: number, y: number] | Float32Array | Float64Array

/** A size represented as `[width, height]` */
export type Size = [width: number, height: number] | Float32Array | Float64Array

/** A very firm array */
type ArRect = [x: number, y: number, width: number, height: number]

/** A rectangle starting at top-left coordinates `[x, y, width, height]` */
export type Rect = ArRect | Float32Array | Float64Array

/** A rectangle starting at top-left coordinates `[x, y, width, height]`.  Requires functions exclusive to `TypedArray`. */
export type Rect32 = Float32Array

/** A point represented as `[x, y]` co-ordinates that will not be modified */
export type ReadOnlyPoint =
  | readonly [x: number, y: number]
  | ReadOnlyTypedArray<Float32Array>
  | ReadOnlyTypedArray<Float64Array>

/** A rectangle starting at top-left coordinates `[x, y, width, height]` that will not be modified */
export type ReadOnlyRect =
  | readonly [x: number, y: number, width: number, height: number]
  | ReadOnlyTypedArray<Float32Array>
  | ReadOnlyTypedArray<Float64Array>

type TypedArrays =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array

type TypedBigIntArrays = BigInt64Array | BigUint64Array
type ReadOnlyTypedArray<T extends TypedArrays | TypedBigIntArrays> =
  Omit<T, "fill" | "copyWithin" | "reverse" | "set" | "sort" | "subarray">

/** Union of property names that are of type Match */
export type KeysOfType<T, Match> = Exclude<{ [P in keyof T]: T[P] extends Match ? P : never }[keyof T], undefined>

/** A new type that contains only the properties of T that are of type Match */
export type PickByType<T, Match> = { [P in keyof T]: Extract<T[P], Match> }

/** The names of all (optional) methods and functions in T */
export type MethodNames<T> = KeysOfType<T, ((...args: any) => any) | undefined>

export interface IBoundaryNodes {
  top: LGraphNode
  right: LGraphNode
  bottom: LGraphNode
  left: LGraphNode
}

export type Direction = "top" | "bottom" | "left" | "right"

export interface IOptionalSlotData<TSlot extends INodeInputSlot | INodeOutputSlot> {
  content: string
  value: TSlot
  className?: string
}

/**
 * A string that represents a specific data / slot type, e.g. `STRING`.
 *
 * Can be comma-delimited to specify multiple allowed types, e.g. `STRING,INT`.
 */
export type ISlotType = number | string

export interface INodeSlot {
  /**
   * The name of the slot in English.
   * Will be included in the serialized data.
   */
  name: string
  /**
   * The localized name of the slot to display in the UI.
   * Takes higher priority than {@link name} if set.
   * Will be included in the serialized data.
   */
  localized_name?: string
  /**
   * The name of the slot to display in the UI, modified by the user.
   * Takes higher priority than {@link display_name} if set.
   * Will be included in the serialized data.
   */
  label?: string

  type: ISlotType
  dir?: LinkDirection
  removable?: boolean
  shape?: RenderShape
  color_off?: CanvasColour
  color_on?: CanvasColour
  locked?: boolean
  nameLocked?: boolean
  pos?: Point
  /**
   * A layout element that is used internally to position the slot.
   * Set by {@link LGraphNode.#layoutSlots}.
   */
  _layoutElement?: LayoutElement<INodeSlot>
  /**
   * A list of floating link IDs that are connected to this slot.
   * This is calculated at runtime; it is **not** serialized.
   */
  _floatingLinks?: Set<LLink>
  /**
   * Whether the slot has errors. It is **not** serialized.
   */
  hasErrors?: boolean
}

export interface INodeFlags {
  skip_repeated_outputs?: boolean
  allow_interaction?: boolean
  pinned?: boolean
  collapsed?: boolean
  /** Configuration setting for {@link LGraphNode.connectInputToOutput} */
  keepAllLinksOnBypass?: boolean
}

/**
 * A widget that is linked to a slot.
 *
 * This is set by the ComfyUI_frontend logic. See
 * https://github.com/Comfy-Org/ComfyUI_frontend/blob/b80e0e1a3c74040f328c4e344326c969c97f67e0/src/extensions/core/widgetInputs.ts#L659
 */
export interface IWidgetLocator {
  name: string
  [key: string | symbol]: unknown
}

export interface INodeInputSlot extends INodeSlot {
  link: LinkId | null
  _layoutElement?: LayoutElement<INodeInputSlot>
  widget?: IWidgetLocator
}

export interface IWidgetInputSlot extends INodeInputSlot {
  widget: IWidgetLocator
}

export interface INodeOutputSlot extends INodeSlot {
  links: LinkId[] | null
  _data?: unknown
  slot_index?: number
  _layoutElement?: LayoutElement<INodeOutputSlot>
}

/** Links */
export interface ConnectingLink extends IInputOrOutput {
  node: LGraphNode
  slot: number
  pos: Point
  direction?: LinkDirection
  afterRerouteId?: RerouteId
  /** The first reroute on a chain */
  firstRerouteId?: RerouteId
  /** The link being moved, or `undefined` if creating a new link. */
  link?: LLink
}

interface IContextMenuBase {
  title?: string
  className?: string
}

/** ContextMenu */
export interface IContextMenuOptions<TValue = unknown, TExtra = unknown> extends IContextMenuBase {
  ignore_item_callbacks?: boolean
  parentMenu?: ContextMenu<TValue>
  event?: MouseEvent
  extra?: TExtra
  /** @deprecated Context menu scrolling is now controlled by the browser */
  scroll_speed?: number
  left?: number
  top?: number
  /** @deprecated Context menus no longer scale using transform */
  scale?: number
  node?: LGraphNode
  autoopen?: boolean
  callback?(
    value?: string | IContextMenuValue<TValue>,
    options?: unknown,
    event?: MouseEvent,
    previous_menu?: ContextMenu<TValue>,
    extra?: unknown,
  ): void | boolean
}

export interface IContextMenuValue<TValue = unknown, TExtra = unknown, TCallbackValue = unknown> extends IContextMenuBase {
  value?: TValue
  content: string | undefined
  has_submenu?: boolean
  disabled?: boolean
  submenu?: IContextMenuSubmenu<TValue>
  property?: string
  type?: string
  slot?: IFoundSlot
  callback?(
    this: ContextMenuDivElement<TValue>,
    value?: TCallbackValue,
    options?: unknown,
    event?: MouseEvent,
    previous_menu?: ContextMenu<TValue>,
    extra?: TExtra,
  ): void | boolean
}

export interface IContextMenuSubmenu<TValue = unknown> extends IContextMenuOptions<TValue> {
  options: ConstructorParameters<typeof ContextMenu<TValue>>[0]
}

export interface ContextMenuDivElement<TValue = unknown> extends HTMLDivElement {
  value?: string | IContextMenuValue<TValue>
  onclick_callback?: never
  closing_timer?: number
}

export type INodeSlotContextItem = [string, ISlotType, Partial<INodeInputSlot & INodeOutputSlot>]
