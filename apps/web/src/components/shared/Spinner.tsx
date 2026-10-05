export function Spinner({ size }: { size?: number }) {
  return (
    <span
      className="spinner"
      style={size ? { width: size, height: size } : undefined}
    />
  );
}
