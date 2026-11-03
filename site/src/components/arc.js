// Geometry for the curved shelf. Books are laid out on a straight line
// (u = distance along the shelf) and bent onto a circle of radius R that
// curves toward the reader, so the reader stands inside the bookcase.

// u: the book's centre along the shelf; scroll: the point that sits at the
// centre of the view; maxTheta: half the visible arc, in radians.
export function arcPlacement(u, scroll, R, maxTheta) {
  const theta = (u - scroll) / R;
  const visible = Math.abs(theta) <= maxTheta;
  // Full opacity over the inner 70% of the arc, then fade to the ends.
  const edge = Math.abs(theta) / maxTheta;
  const opacity = visible ? (edge <= 0.7 ? 1 : Math.max(0, 1 - (edge - 0.7) / 0.3)) : 0;
  return {
    x: R * Math.sin(theta),
    z: R * (1 - Math.cos(theta)),
    rotateY: theta === 0 ? 0 : (-theta * 180) / Math.PI,
    opacity,
    visible
  };
}

export function clampScroll(scroll, length) {
  return Math.min(length, Math.max(0, scroll));
}
