export default function ProductPageLoading() {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
@keyframes gf-shimmer {
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
@keyframes gf-fade-up {
  0% { opacity: 0; transform: translateY(6px); }
  100% { opacity: 1; transform: translateY(0); }
}`,
        }}
      />
      <div className="min-h-screen bg-white">
        {/* Header skeleton */}
        <header className="border-b border-gray-100">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-2.5">
              <div
                className="h-7 w-7 rounded"
                style={{
                  background:
                    "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                  backgroundSize: "800px 100%",
                  animation: "gf-shimmer 1.8s ease-in-out infinite",
                }}
              />
              <div
                className="h-4 w-28 rounded"
                style={{
                  background:
                    "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                  backgroundSize: "800px 100%",
                  animation: "gf-shimmer 1.8s ease-in-out infinite",
                }}
              />
            </div>
            <div
              className="h-6 w-16 rounded-md"
              style={{
                background:
                  "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                backgroundSize: "800px 100%",
                animation: "gf-shimmer 1.8s ease-in-out infinite",
              }}
            />
          </div>
        </header>

        {/* Hero skeleton */}
        <main className="mx-auto max-w-2xl px-6 py-20 text-center">
          <div style={{ animation: "gf-fade-up 0.4s ease-out 100ms both" }}>
            {/* Badge */}
            <div
              className="mx-auto mb-5 h-6 w-40 rounded-md"
              style={{
                background:
                  "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                backgroundSize: "800px 100%",
                animation: "gf-shimmer 1.8s ease-in-out infinite",
              }}
            />
            {/* Title */}
            <div
              className="mx-auto mb-4 h-10 w-80 rounded"
              style={{
                background:
                  "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                backgroundSize: "800px 100%",
                animation: "gf-shimmer 1.8s ease-in-out infinite",
              }}
            />
            {/* Description */}
            <div
              className="mx-auto mb-2 h-4 w-96 max-w-full rounded"
              style={{
                background:
                  "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                backgroundSize: "800px 100%",
                animation: "gf-shimmer 1.8s ease-in-out infinite",
              }}
            />
            <div
              className="mx-auto mb-10 h-4 w-64 rounded"
              style={{
                background:
                  "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                backgroundSize: "800px 100%",
                animation: "gf-shimmer 1.8s ease-in-out infinite",
              }}
            />
            {/* CTA button placeholder */}
            <div
              className="mx-auto h-12 w-48 rounded-xl"
              style={{
                background:
                  "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                backgroundSize: "800px 100%",
                animation: "gf-shimmer 1.8s ease-in-out infinite",
              }}
            />
          </div>
        </main>
      </div>
    </>
  );
}
