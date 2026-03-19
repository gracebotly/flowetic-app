export default function ClientPortalLoading() {
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
      <div className="min-h-screen bg-gray-50">
        {/* Header skeleton */}
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
            <div className="flex items-center gap-3">
              <div
                className="h-8 w-8 rounded-lg"
                style={{
                  background:
                    "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                  backgroundSize: "800px 100%",
                  animation: "gf-shimmer 1.8s ease-in-out infinite",
                }}
              />
              <div
                className="h-4 w-32 rounded"
                style={{
                  background:
                    "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                  backgroundSize: "800px 100%",
                  animation: "gf-shimmer 1.8s ease-in-out infinite",
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <div
                className="h-5 w-20 rounded"
                style={{
                  background:
                    "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                  backgroundSize: "800px 100%",
                  animation: "gf-shimmer 1.8s ease-in-out infinite",
                }}
              />
              <div
                className="h-8 w-8 rounded-full"
                style={{
                  background:
                    "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                  backgroundSize: "800px 100%",
                  animation: "gf-shimmer 1.8s ease-in-out infinite",
                }}
              />
            </div>
          </div>
          {/* Tab row skeleton */}
          <div className="mx-auto flex max-w-7xl gap-6 px-6">
            <div
              className="h-4 w-24 rounded"
              style={{
                marginBottom: "12px",
                background:
                  "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                backgroundSize: "800px 100%",
                animation: "gf-shimmer 1.8s ease-in-out infinite",
              }}
            />
            <div
              className="h-4 w-20 rounded"
              style={{
                marginBottom: "12px",
                background:
                  "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                backgroundSize: "800px 100%",
                animation: "gf-shimmer 1.8s ease-in-out infinite",
              }}
            />
          </div>
        </header>

        {/* Dashboard content skeleton */}
        <main className="mx-auto max-w-7xl px-6 py-8">
          {/* Metric cards row */}
          <div
            className="grid grid-cols-2 gap-4 sm:grid-cols-4"
            style={{ animation: "gf-fade-up 0.4s ease-out 100ms both" }}
          >
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-gray-100 bg-white p-5"
              >
                <div
                  className="mb-3 h-3 w-20 rounded"
                  style={{
                    background:
                      "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                    backgroundSize: "800px 100%",
                    animation: "gf-shimmer 1.8s ease-in-out infinite",
                  }}
                />
                <div
                  className="h-7 w-16 rounded"
                  style={{
                    background:
                      "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                    backgroundSize: "800px 100%",
                    animation: "gf-shimmer 1.8s ease-in-out infinite",
                  }}
                />
              </div>
            ))}
          </div>

          {/* Chart placeholder */}
          <div
            className="mt-6 rounded-xl border border-gray-100 bg-white p-6"
            style={{ animation: "gf-fade-up 0.4s ease-out 250ms both" }}
          >
            <div
              className="mb-4 h-4 w-40 rounded"
              style={{
                background:
                  "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                backgroundSize: "800px 100%",
                animation: "gf-shimmer 1.8s ease-in-out infinite",
              }}
            />
            <div
              className="h-48 w-full rounded-lg"
              style={{
                background:
                  "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                backgroundSize: "800px 100%",
                animation: "gf-shimmer 1.8s ease-in-out infinite",
              }}
            />
          </div>

          {/* Table placeholder */}
          <div
            className="mt-6 rounded-xl border border-gray-100 bg-white p-6"
            style={{ animation: "gf-fade-up 0.4s ease-out 400ms both" }}
          >
            <div
              className="mb-4 h-4 w-32 rounded"
              style={{
                background:
                  "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                backgroundSize: "800px 100%",
                animation: "gf-shimmer 1.8s ease-in-out infinite",
              }}
            />
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-4 border-t border-gray-50 py-3"
              >
                <div
                  className="h-4 w-full rounded"
                  style={{
                    background:
                      "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                    backgroundSize: "800px 100%",
                    animation: "gf-shimmer 1.8s ease-in-out infinite",
                    animationDelay: `${i * 100}ms`,
                  }}
                />
              </div>
            ))}
          </div>
        </main>
      </div>
    </>
  );
}
