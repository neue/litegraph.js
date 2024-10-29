import type { Direction, IBoundaryNodes, Positionable } from "../interfaces"
import type { LGraphNode } from "../LGraphNode"

interface IBoundaryItems {
  top: Positionable
  right: Positionable
  bottom: Positionable
  left: Positionable
}

/**
 * Finds the nodes that are farthest in all four directions, representing the boundary of the nodes.
 * @param nodes The nodes to check the edges of
 * @returns An object listing the furthest node (edge) in all four directions.
 * `null` if no nodes were supplied or the first node was falsy.
 */
export function getBoundaryNodes(nodes: LGraphNode[]): IBoundaryNodes | null {
  const valid = nodes?.find(x => x)
  if (!valid) return null

  let top = valid
  let right = valid
  let bottom = valid
  let left = valid

  for (const node of nodes) {
    if (!node) continue
    const [x, y] = node.pos
    const [width, height] = node.size

    if (y < top.pos[1]) top = node
    if (x + width > right.pos[0] + right.size[0]) right = node
    if (y + height > bottom.pos[1] + bottom.size[1]) bottom = node
    if (x < left.pos[0]) left = node
  }

  return {
    top,
    right,
    bottom,
    left,
  }
}

/**
 * Finds the positionable items that are farthest in all four directions, representing the boundary of the items.
 * @param items The items to check the edges of
 * @returns An object listing the furthest item (edge) in all four directions.  `null` if no items were supplied or the first item was falsy.
 */
export function getBoundaryItems(items: Iterable<Positionable, Positionable, Positionable>): IBoundaryItems | null {
  const valid = items[Symbol.iterator]().next().value
  if (!valid) return null

  let top = valid
  let right = valid
  let bottom = valid
  let left = valid

  for (const item of items) {
    if (!item) continue
    const [x, y, width, height] = item.boundingRect

    if (y < top.boundingRect[1]) top = item
    if (x + width > right.boundingRect[0] + right.boundingRect[2]) right = item
    if (y + height > bottom.boundingRect[1] + bottom.boundingRect[3]) bottom = item
    if (x < left.boundingRect[0]) left = item
  }

  return {
    top,
    right,
    bottom,
    left,
  }
}

/**
 * Distributes nodes evenly along a horizontal or vertical plane.
 * @param nodes The nodes to distribute
 * @param horizontal If true, distributes along the horizontal plane.  Otherwise, the vertical plane.
 */
export function distributeNodes(nodes: LGraphNode[], horizontal?: boolean): void {
  const nodeCount = nodes?.length
  if (!(nodeCount > 1)) return

  const index = horizontal ? 0 : 1

  let total = 0
  let highest = -Infinity

  for (const node of nodes) {
    total += node.size[index]

    const high = node.pos[index] + node.size[index]
    if (high > highest) highest = high
  }
  const sorted = [...nodes].sort((a, b) => a.pos[index] - b.pos[index])
  const lowest = sorted[0].pos[index]

  const gap = (highest - lowest - total) / (nodeCount - 1)
  let startAt = lowest
  for (let i = 0; i < nodeCount; i++) {
    const node = sorted[i]
    node.pos[index] = startAt + gap * i
    startAt += node.size[index]
  }
}

/**
 * Distributes items evenly along a horizontal or vertical plane.
 * @param items The items to distribute
 * @param horizontal If true, distributes along the horizontal plane.  Otherwise, the vertical plane.
 */
export function distributeItems(items: Iterable<Positionable>, horizontal?: boolean): void {
  const posIndex = horizontal ? 1 : 0
  const sizeIndex = posIndex + 2

  let count = 0
  let total = 0
  let highest = -Infinity

  for (const item of items) {
    count++
    const widthOrHeight = item.boundingRect[sizeIndex]
    total += widthOrHeight

    const high = item.pos[posIndex] + widthOrHeight
    if (high > highest) highest = high
  }
  if (!total) return

  const sorted = [...items].sort((a, b) => a.pos[posIndex] - b.pos[posIndex])
  const lowest = sorted[0].pos[posIndex]

  const gap = ((highest - lowest) - total) / (count - 1)
  let startAt = lowest
  for (let i = 0; i < count; i++) {
    const item = sorted[i]
    item.pos[posIndex] = startAt + (gap * i)
    startAt += item.boundingRect[sizeIndex]
  }
}

/**
 * Aligns all nodes along the edge of a node.
 * @param nodes The nodes to align
 * @param direction The edge to align nodes on
 * @param align_to The node to align all other nodes to.  If undefined, the farthest node will be used.
 */
export function alignNodes(
  nodes: LGraphNode[],
  direction: Direction,
  align_to?: LGraphNode,
): void {
  if (!nodes) return

  const boundary = align_to === undefined
    ? getBoundaryNodes(nodes)
    : { top: align_to, right: align_to, bottom: align_to, left: align_to }

  if (boundary === null) return

  for (const node of nodes) {
    switch (direction) {
    case "right":
      node.pos[0] = boundary.right.pos[0] + boundary.right.size[0] - node.size[0]
      break
    case "left":
      node.pos[0] = boundary.left.pos[0]
      break
    case "top":
      node.pos[1] = boundary.top.pos[1]
      break
    case "bottom":
      node.pos[1] = boundary.bottom.pos[1] + boundary.bottom.size[1] - node.size[1]
      break
    }
  }
}

export function alignItems(items: Iterable<Positionable>, direction: Direction, alignTo?: Positionable): void {
  if (!items) return

  const boundary = alignTo === undefined
    ? getBoundaryItems(items)
    : {
      top: alignTo,
      right: alignTo,
      bottom: alignTo,
      left: alignTo,
    }

  if (boundary === null) return

  for (const item of items) {
    switch (direction) {
    case "right":
      item.pos[0] = boundary.right.pos[0] + boundary.right.boundingRect[2] - item.boundingRect[2]
      break
    case "left":
      item.pos[0] = boundary.left.pos[0]
      break
    case "top":
      item.pos[1] = boundary.top.pos[1]
      break
    case "bottom":
      item.pos[1] = boundary.bottom.pos[1] + boundary.bottom.boundingRect[3] - item.boundingRect[3]
      break
    }
  }
}
