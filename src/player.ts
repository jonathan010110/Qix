type Vec = { x: number; y: number };

export class Player {
  pos: Vec;
  speed = 200; // px / sek
  radius = 6;
  private isInside = false;
  private trail: SVGPolylineElement | null = null;
  private trailPoints: string[] = [];
  private spaceDown = false;
  private trailStart: { x: number; y: number } | null = null;
  private polylineEdges: Array<Array<{ x: number; y: number }>> = [];
  private filledPolygons: Array<{ points: Array<{ x: number; y: number }>, element: SVGPolygonElement }> = [];

  private svg:SVGSVGElement;
  private circle: SVGCircleElement;
  private keys: Record<string, boolean> = {};

  constructor( start: Vec,svg: string) {
    this.svg = document.getElementById(svg) as unknown as SVGSVGElement
    this.pos = { ...start };

    // SVG Circle erzeugen
    this.circle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle"
    );
    this.circle.setAttribute("r", this.radius.toString());
    this.circle.setAttribute("fill", "#4fd1c5");

    this.svg.appendChild(this.circle);

    // Input
    window.addEventListener("keydown", e => {
      // Toggle inside only when pressing Space from the edge
      if (e.code === "Space" && !this.spaceDown) {
        this.spaceDown = true;
        const mapWidth = 600;
        const mapHeight = 400;
        const margin = this.radius;
        const distLeft = this.pos.x;
        const distRight = mapWidth - this.pos.x;
        const distTop = this.pos.y;
        const distBottom = mapHeight - this.pos.y;
        const nearestDist = Math.min(distLeft, distRight, distTop, distBottom);

        // Can jump if on outer edge OR on a polyline edge
        const onOuterEdge = nearestDist <= margin;
        const onPolylineEdge = this.isNearPolylineEdge();

        if (!this.isInside && (onOuterEdge || onPolylineEdge)) {
          this.isInside = true;
          // start a new trail
          this.trail = document.createElementNS("http://www.w3.org/2000/svg", "polyline") as SVGPolylineElement;
          this.trail.setAttribute("fill", "none");
          this.trail.setAttribute("stroke", "#4fd1c5");
          this.trail.setAttribute("stroke-width", "2");
          this.trailPoints = [`${this.pos.x},${this.pos.y}`];
          this.trail.setAttribute("points", this.trailPoints.join(" "));
          this.svg.appendChild(this.trail);
          this.trailStart = { x: this.pos.x, y: this.pos.y };
        }

        e.preventDefault();
      }

      this.keys[e.key] = true;
    });

    window.addEventListener("keyup", e => {
      this.keys[e.key] = false;
      if (e.code === "Space") this.spaceDown = false;
    });

    this.render();
  }

  /** Calculate distance from point to line segment */
  private distToSegment(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const closest = { x: a.x + t * dx, y: a.y + t * dy };
    return Math.hypot(p.x - closest.x, p.y - closest.y);
  }

  /** Check if player is near any polyline edge */
  private isNearPolylineEdge(): boolean {
    for (const edge of this.polylineEdges) {
      for (let i = 0; i < edge.length - 1; i++) {
        if (this.distToSegment(this.pos, edge[i]!, edge[i + 1]!) <= this.radius) {
          return true;
        }
      }
    }
    return false;
  }

  /** Check if point is inside polygon using ray casting */
  private isPointInPolygon(p: { x: number; y: number }, polygon: Array<{ x: number; y: number }>): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i]!.x, yi = polygon[i]!.y;
      const xj = polygon[j]!.x, yj = polygon[j]!.y;
      const intersect = ((yi > p.y) !== (yj > p.y)) && (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /** Check if two polygons overlap */
  private doPolygonsOverlap(poly1: Array<{ x: number; y: number }>, poly2: Array<{ x: number; y: number }>): boolean {
    // Check if any point of poly1 is inside poly2
    for (const p of poly1) {
      if (this.isPointInPolygon(p, poly2)) return true;
    }
    // Check if any point of poly2 is inside poly1
    for (const p of poly2) {
      if (this.isPointInPolygon(p, poly1)) return true;
    }
    return false;
  }

  /** Merge overlapping polygons using convex hull */
  private mergePolygons(poly1: Array<{ x: number; y: number }>, poly2: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
    // Combine all unique points
    const combined = [...poly1, ...poly2];
    
    // Remove duplicates
    const unique: Array<{ x: number; y: number }> = [];
    for (const p of combined) {
      if (!unique.some(u => Math.abs(u.x - p.x) < 1 && Math.abs(u.y - p.y) < 1)) {
        unique.push(p);
      }
    }

    if (unique.length <= 3) return unique;

    // Graham scan for convex hull
    // Find the point with lowest y (and leftmost if tie)
    let minIdx = 0;
    for (let i = 1; i < unique.length; i++) {
      if (unique[i]!.y < unique[minIdx]!.y || 
          (unique[i]!.y === unique[minIdx]!.y && unique[i]!.x < unique[minIdx]!.x)) {
        minIdx = i;
      }
    }
    const start = unique[minIdx]!;

    // Sort by polar angle with respect to start pointX
    const sorted = unique.filter((_, i) => i !== minIdx).sort((a, b) => {
      const angleA = Math.atan2(a.y - start!.y, a.x - start!.x);
      const angleB = Math.atan2(b.y - start!.y, b.x - start!.x);
      return angleA - angleB;
    });

    // Build hull
    const hull: Array<{ x: number; y: number }> = [start];
    
    for (const p of sorted) {
      // Remove points that make a right turn
      while (hull.length >= 2) {
        const o = hull[hull.length - 2]!;
        const a = hull[hull.length - 1]!;
        const cross = (a.x - o.x) * (p.y - o.y) - (a.y - o.y) * (p.x - o.x);
        if (cross <= 0) {
          hull.pop();
        } else {
          break;
        }
      }
      hull.push(p);
    }

    return hull;
  }

  /** Bewegung über Pfeiltasten */
  move(dt: number) {
    let dx = 0;
    let dy = 0;

    if (this.keys["ArrowLeft"]) dx -= 1;
    if (this.keys["ArrowRight"]) dx += 1;
    if (this.keys["ArrowUp"]) dy -= 1;
    if (this.keys["ArrowDown"]) dy += 1;

    // Prevent diagonal movement - only allow one direction at a time
    if (dx !== 0 && dy !== 0) {
      dy = 0;
    }

    this.pos.x += dx * this.speed * dt;
    this.pos.y += dy * this.speed * dt;

    const mapWidth = 600;
    const mapHeight = 400;
    const margin = this.radius;

    // Check if touching an edge
    const distLeft = this.pos.x;
    const distRight = mapWidth - this.pos.x;
    const distTop = this.pos.y;
    const distBottom = mapHeight - this.pos.y;
    const nearestDist = Math.min(distLeft, distRight, distTop, distBottom);

    // If inside, append to trail when moved enough
    if (this.isInside && this.trail) {
      const last = this.trailPoints.length ? this.trailPoints[this.trailPoints.length - 1] : null;
      if (last) {
        const [lx, ly] = last.split(",").map(Number) as [number, number];
        const ddx = this.pos.x - lx;
        const ddy = this.pos.y - ly;
        if (Math.hypot(ddx, ddy) > 2) {
          this.trailPoints.push(`${this.pos.x},${this.pos.y}`);
          this.trail.setAttribute("points", this.trailPoints.join(" "));
        }
      } else {
        this.trailPoints.push(`${this.pos.x},${this.pos.y}`);
        this.trail.setAttribute("points", this.trailPoints.join(" "));
      }
    }

    // If touching edge, snap back to edge mode
    if (nearestDist <= margin) {
      this.isInside = false;

      // finalize trail: convert polyline into filled polygon that follows the perimeter
      if (this.trail && this.trailStart) {
        const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");

        const getSide = (p: { x: number; y: number }) => {
          if (Math.abs(p.x - margin) < 1e-3) return "left";
          if (Math.abs(p.x - (mapWidth - margin)) < 1e-3) return "right";
          if (Math.abs(p.y - margin) < 1e-3) return "top";
          if (Math.abs(p.y - (mapHeight - margin)) < 1e-3) return "bottom";
          const dLeft = Math.abs(p.x - margin);
          const dRight = Math.abs(p.x - (mapWidth - margin));
          const dTop = Math.abs(p.y - margin);
          const dBottom = Math.abs(p.y - (mapHeight - margin));
          const min = Math.min(dLeft, dRight, dTop, dBottom);
          if (min === dLeft) return "left";
          if (min === dRight) return "right";
          if (min === dTop) return "top";
          return "bottom";
        };

        const corners = [
          { x: 0, y: 0 },
          { x: mapWidth, y: 0 },
          { x: mapWidth, y: mapHeight },
          { x: 0, y: mapHeight },
        ];

        const sideIndex = (s: string) => (s === "top" ? 0 : s === "right" ? 1 : s === "bottom" ? 2 : 3);

        const startPt = this.trailStart;
        const endPt = { x: this.pos.x, y: this.pos.y };
        const startIdx = sideIndex(getSide(startPt));
        const endIdx = sideIndex(getSide(endPt));

        const perimeterPoints: string[] = [];
        perimeterPoints.push(`${endPt.x},${endPt.y}`);

        if (endIdx !== startIdx) {
          let k = endIdx;
          while (k !== startIdx) {
            const corner = corners[(k + 1) % 4]!;
            perimeterPoints.push(`${corner.x},${corner.y}`);
            k = (k + 1) % 4;
          }
        }

        perimeterPoints.push(`${startPt.x},${startPt.y}`);

        // Build polygon points starting at the trail start to keep winding consistent
        const startStr = `${startPt.x},${startPt.y}`;
        const endStr = `${endPt.x},${endPt.y}`;
        // trailPoints already starts with startStr; ensure ordering: start -> (interior) -> end -> perimeter back to start
        let polyPoints = [startStr];
        if (this.trailPoints.length > 1) polyPoints = polyPoints.concat(this.trailPoints.slice(1));
        polyPoints.push(endStr);
        polyPoints = polyPoints.concat(perimeterPoints.slice(1));

        // remove consecutive duplicate points
        polyPoints = polyPoints.filter((p, i, arr) => i === 0 || p !== arr[i - 1]);

        // Store the trail segments as polyline edges
        const trailSegments = this.trailPoints.map(pt => {
          const [x, y] = pt.split(",").map(Number) as [number, number];
          return { x, y };
        });
        if (trailSegments.length > 1) {
          this.polylineEdges.push(trailSegments);
        }

        // Convert polyPoints to vector format
        const newPolygonPoints = polyPoints.map(pt => {
          const [x, y] = pt.split(",").map(Number) as [number, number];
          return { x, y };
        });

        // Check for overlaps with existing polygons
        let overlappingIndices: number[] = [];
        for (let i = 0; i < this.filledPolygons.length; i++) {
          if (this.doPolygonsOverlap(newPolygonPoints, this.filledPolygons[i]!.points)) {
            overlappingIndices.push(i);
          }
        }

        // If overlaps found, merge them all
        let finalPolygon = newPolygonPoints;
        if (overlappingIndices.length > 0) {
          // Start with the new polygon
          let merged = [...newPolygonPoints];
          // Merge all overlapping polygons
          for (const idx of overlappingIndices) {
            merged = this.mergePolygons(merged, this.filledPolygons[idx]!.points);
          }
          finalPolygon = merged;

          // Remove old polygon SVG elements (in reverse order to preserve indices)
          for (let i = overlappingIndices.length - 1; i >= 0; i--) {
            const idx = overlappingIndices[i]!;
            if (this.filledPolygons[idx]!.element.parentNode) {
              this.filledPolygons[idx]!.element.parentNode.removeChild(this.filledPolygons[idx]!.element);
            }
            this.filledPolygons.splice(idx, 1);
          }
        }

        // Create merged polygon string
        const finalPolyPointsStr = finalPolygon.map(p => `${p.x},${p.y}`).join(" ");

        poly.setAttribute("points", finalPolyPointsStr);
        poly.setAttribute("fill", "#cbd5e0");
        poly.setAttribute("fill-rule", "evenodd");
        poly.setAttribute("stroke", "#4fd1c5");
        poly.setAttribute("stroke-width", "1");
        this.svg.appendChild(poly);

        // Store the final merged polygon
        this.filledPolygons.push({
          points: finalPolygon,
          element: poly
        });

        if (this.trail.parentNode) this.trail.parentNode.removeChild(this.trail);
        this.trail = null;
        this.trailPoints = [];
        this.trailStart = null;
      }

      // Snap to nearest edge
      if (nearestDist === distLeft) {
        this.pos.x = margin;
        this.pos.y = Math.max(margin, Math.min(mapHeight - margin, this.pos.y));
      } else if (nearestDist === distRight) {
        this.pos.x = mapWidth - margin;
        this.pos.y = Math.max(margin, Math.min(mapHeight - margin, this.pos.y));
      } else if (nearestDist === distTop) {
        this.pos.y = margin;
        this.pos.x = Math.max(margin, Math.min(mapWidth - margin, this.pos.x));
      } else if (nearestDist === distBottom) {
        this.pos.y = mapHeight - margin;
        this.pos.x = Math.max(margin, Math.min(mapWidth - margin, this.pos.x));
      }
    } else if (!this.isInside) {
      // Not inside and not touching edge - constrain to nearest edge (outer or polyline)
      // First check if near a polyline edge
      let minPolylineDist = Infinity;
      let nearestPolylinePoint: { x: number; y: number } | null = null;

      for (const edge of this.polylineEdges) {
        for (let i = 0; i < edge.length - 1; i++) {
          const dist = this.distToSegment(this.pos, edge[i]!, edge[i + 1]!);
          if (dist < minPolylineDist) {
            minPolylineDist = dist;
            // Find closest point on segment
            const a = edge[i]!;
            const b = edge[i + 1]!;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const len2 = dx * dx + dy * dy;
            let t = len2 === 0 ? 0 : ((this.pos.x - a.x) * dx + (this.pos.y - a.y) * dy) / len2;
            t = Math.max(0, Math.min(1, t));
            nearestPolylinePoint = { x: a.x + t * dx, y: a.y + t * dy };
          }
        }
      }

      // Compare polyline distance to outer edge distance
      if (minPolylineDist < 50 && nearestPolylinePoint && minPolylineDist <= Math.min(distLeft, distRight, distTop, distBottom)) {
        // Snap to polyline
        this.pos = { ...nearestPolylinePoint };
      } else {
        // Snap to outer edge
        if (distLeft < distRight && distLeft < distTop && distLeft < distBottom) {
          this.pos.x = margin;
        } else if (distRight < distLeft && distRight < distTop && distRight < distBottom) {
          this.pos.x = mapWidth - margin;
        } else if (distTop < distLeft && distTop < distRight && distTop < distBottom) {
          this.pos.y = margin;
        } else if (distBottom < distLeft && distBottom < distRight && distBottom < distTop) {
          this.pos.y = mapHeight - margin;
        }
      }
    }
  }

  /** Update pro Frame */
  update(dt: number) {
    this.move(dt);
    this.render();
  }

  /** SVG aktualisieren */
  public render() {
    this.circle.setAttribute("cx", this.pos.x.toString());
    this.circle.setAttribute("cy", this.pos.y.toString());
  }
}
