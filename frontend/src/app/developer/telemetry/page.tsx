import { notFound } from "next/navigation";
import TelemetryClient from "./telemetryClient";

export default function DevTelemetryPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <TelemetryClient />;
}
