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

        if (!this.isInside && nearestDist <= margin) {
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
        const [lx, ly] = last.split(",").map(Number);
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
          { x: margin, y: margin },
          { x: mapWidth - margin, y: margin },
          { x: mapWidth - margin, y: mapHeight - margin },
          { x: margin, y: mapHeight - margin },
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
            const corner = corners[(k + 1) % 4];
            perimeterPoints.push(`${corner.x},${corner.y}`);
            k = (k + 1) % 4;
          }
        }

        perimeterPoints.push(`${startPt.x},${startPt.y}`);

        const polyPoints = [...this.trailPoints, `${endPt.x},${endPt.y}`, ...perimeterPoints.slice(1)];

        poly.setAttribute("points", polyPoints.join(" "));
        poly.setAttribute("fill", "#cbd5e0");
        poly.setAttribute("stroke", "#4fd1c5");
        poly.setAttribute("stroke-width", "1");
        this.svg.appendChild(poly);

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
      // Not inside and not touching edge - constrain to nearest edge
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
