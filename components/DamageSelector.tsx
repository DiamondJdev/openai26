"use client";

import { DAMAGE_REGIONS, REGION_META, type DamageRegion } from "@/lib/domain/regions";
import { VEHICLE_TYPES, type VehicleType } from "@/lib/domain/vehicle";
import { OVERLINE } from "@/components/ui";

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Top-down schematic layout of the 8 regions, per vehicle silhouette. */
function layout(vehicle: VehicleType): Record<DamageRegion, Box> {
  const roofH = vehicle === "pickup" ? 70 : 120;
  const rearTop = 162 + roofH + 4;
  return {
    front_bumper: { x: 10, y: 8, w: 200, h: 32 },
    driver_side: { x: 10, y: 44, w: 44, h: 312 },
    passenger_side: { x: 166, y: 44, w: 44, h: 312 },
    hood: { x: 58, y: 44, w: 104, h: 66 },
    windshield: { x: 58, y: 114, w: 104, h: 44 },
    roof: { x: 58, y: 162, w: 104, h: roofH },
    rear_body: { x: 58, y: rearTop, w: 104, h: 356 - rearTop },
    rear_bumper: { x: 10, y: 360, w: 200, h: 32 },
  };
}

/** The narrow side rails read better with rotated labels. */
function labelTransform(region: DamageRegion, b: Box): string | undefined {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  if (region === "driver_side") return `rotate(-90 ${cx} ${cy})`;
  if (region === "passenger_side") return `rotate(90 ${cx} ${cy})`;
  return undefined;
}

export interface DamageSelectorProps {
  vehicleType: VehicleType;
  selected: readonly DamageRegion[];
  onVehicleTypeChange: (v: VehicleType) => void;
  onToggle: (region: DamageRegion) => void;
  disabled?: boolean;
}

export function DamageSelector({
  vehicleType,
  selected,
  onVehicleTypeChange,
  onToggle,
  disabled = false,
}: DamageSelectorProps) {
  const boxes = layout(vehicleType);
  const selectedSet = new Set(selected);

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className={`mb-2 ${OVERLINE}`}>Vehicle type</legend>
        <div role="radiogroup" aria-label="Vehicle type" className="flex gap-2">
          {VEHICLE_TYPES.map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={vehicleType === v}
              disabled={disabled}
              onClick={() => onVehicleTypeChange(v)}
              className={`min-h-touch rounded-md border px-4 py-2 capitalize transition-colors ${
                vehicleType === v
                  ? "border-fg bg-accent-weak font-medium text-fg"
                  : "border-border text-muted hover:border-muted hover:text-fg"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={`mb-2 ${OVERLINE}`}>
          Reported areas (select all that apply)
        </legend>
        <svg
          viewBox="0 0 220 400"
          className="mx-auto block h-auto w-full max-w-[300px]"
          role="group"
          aria-label={`${vehicleType} damage area diagram`}
        >
          {DAMAGE_REGIONS.map((region) => {
            const b = boxes[region];
            const isOn = selectedSet.has(region);
            return (
              <g
                key={region}
                role="button"
                tabIndex={disabled ? -1 : 0}
                aria-pressed={isOn}
                aria-label={REGION_META[region].label}
                onClick={() => !disabled && onToggle(region)}
                onKeyDown={(e) => {
                  if (disabled) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onToggle(region);
                  }
                }}
                className="cursor-pointer outline-none [&:hover>rect]:stroke-muted focus-visible:[&>rect]:stroke-signal"
              >
                <rect
                  x={b.x}
                  y={b.y}
                  width={b.w}
                  height={b.h}
                  rx={3}
                  fill={isOn ? "var(--color-accent-weak)" : "var(--color-surface-2)"}
                  stroke={isOn ? "var(--color-fg)" : "var(--color-border)"}
                  strokeWidth={isOn ? 2 : 1}
                  className="transition-colors"
                />
                <text
                  x={b.x + b.w / 2}
                  y={b.y + b.h / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={labelTransform(region, b)}
                  fontSize={10}
                  fontWeight={isOn ? 600 : 500}
                  fill={isOn ? "var(--color-fg)" : "var(--color-muted)"}
                >
                  {REGION_META[region].label}
                </text>
              </g>
            );
          })}
        </svg>
      </fieldset>

      <div aria-live="polite">
        {selected.length === 0 ? (
          <p className="text-sm text-muted">No areas selected yet.</p>
        ) : (
          <ul aria-label="Selected areas" className="flex flex-wrap gap-1.5">
            {selected.map((r) => (
              <li
                key={r}
                className="rounded border border-border bg-accent-weak px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wide"
              >
                {REGION_META[r].label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
