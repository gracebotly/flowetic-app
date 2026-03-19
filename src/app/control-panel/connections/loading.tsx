export default function ConnectionsLoading() {
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
      <div className="mx-auto max-w-6xl p-6">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div
              className="mb-2 h-7 w-48 rounded"
              style={{
                background:
                  "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                backgroundSize: "800px 100%",
                animation: "gf-shimmer 1.8s ease-in-out infinite",
              }}
            />
            <div
              className="h-4 w-80 rounded"
              style={{
                background:
                  "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                backgroundSize: "800px 100%",
                animation: "gf-shimmer 1.8s ease-in-out infinite",
              }}
            />
          </div>
          <div className="flex gap-2">
            <div
              className="h-10 w-28 rounded-lg"
              style={{
                background:
                  "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                backgroundSize: "800px 100%",
                animation: "gf-shimmer 1.8s ease-in-out infinite",
              }}
            />
            <div
              className="h-10 w-36 rounded-lg"
              style={{
                background:
                  "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                backgroundSize: "800px 100%",
                animation: "gf-shimmer 1.8s ease-in-out infinite",
              }}
            />
          </div>
        </div>

        {/* Tab bar skeleton */}
        <div className="mt-6 flex gap-4 border-b border-gray-200 pb-3">
          <div
            className="h-4 w-24 rounded"
            style={{
              background:
                "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
              backgroundSize: "800px 100%",
              animation: "gf-shimmer 1.8s ease-in-out infinite",
            }}
          />
          <div
            className="h-4 w-20 rounded"
            style={{
              background:
                "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
              backgroundSize: "800px 100%",
              animation: "gf-shimmer 1.8s ease-in-out infinite",
            }}
          />
        </div>

        {/* Credential card skeletons */}
        <div className="mt-6 space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-lg border border-gray-100 bg-white p-4"
              style={{ animation: `gf-fade-up 0.4s ease-out ${i * 100}ms both` }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className="h-10 w-10 rounded-lg"
                    style={{
                      background:
                        "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                      backgroundSize: "800px 100%",
                      animation: "gf-shimmer 1.8s ease-in-out infinite",
                    }}
                  />
                  <div>
                    <div
                      className="mb-2 h-4 w-36 rounded"
                      style={{
                        background:
                          "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                        backgroundSize: "800px 100%",
                        animation: "gf-shimmer 1.8s ease-in-out infinite",
                      }}
                    />
                    <div
                      className="h-3 w-48 rounded"
                      style={{
                        background:
                          "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                        backgroundSize: "800px 100%",
                        animation: "gf-shimmer 1.8s ease-in-out infinite",
                      }}
                    />
                  </div>
                </div>
                <div
                  className="h-8 w-8 rounded"
                  style={{
                    background:
                      "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                    backgroundSize: "800px 100%",
                    animation: "gf-shimmer 1.8s ease-in-out infinite",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
