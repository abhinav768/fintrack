export default function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="backdrop-wash absolute inset-0" />
      <div className="backdrop-fade absolute inset-0">
        <div className="backdrop-contours absolute inset-0" />
      </div>
    </div>
  );
}
