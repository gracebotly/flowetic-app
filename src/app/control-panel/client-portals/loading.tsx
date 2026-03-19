export default function ClientPortalsLoading() {
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
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div>
            <div
              className="mb-2 h-7 w-40 rounded"
              style={{
                background:
                  "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                backgroundSize: "800px 100%",
                animation: "gf-shimmer 1.8s ease-in-out infinite",
              }}
            />
            <div
              className="h-4 w-64 rounded"
              style={{
                background:
                  "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                backgroundSize: "800px 100%",
                animation: "gf-shimmer 1.8s ease-in-out infinite",
              }}
            />
          </div>
          <div
            className="h-10 w-32 rounded-lg"
            style={{
              background:
                "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
              backgroundSize: "800px 100%",
              animation: "gf-shimmer 1.8s ease-in-out infinite",
            }}
          />
        </div>

        {/* Table skeleton */}
        <div className="mt-8 overflow-hidden rounded-xl border border-gray-200 bg-white">
          {/* Table header */}
          <div className="flex gap-4 border-b border-gray-100 bg-gray-50/50 px-4 py-3">
            {[120, 80, 80, 60, 60].map((w, i) => (
              <div
                key={i}
                className="h-3 rounded"
                style={{
                  width: `${w}px`,
                  background:
                    "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                  backgroundSize: "800px 100%",
                  animation: "gf-shimmer 1.8s ease-in-out infinite",
                }}
              />
            ))}
          </div>
          {/* Table rows */}
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-gray-50 px-4 py-3"
              style={{ animation: `gf-fade-up 0.4s ease-out ${i * 80}ms both` }}
            >
              <div
                className="h-4 w-40 rounded"
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
              <div
                className="h-5 w-16 rounded-full"
                style={{
                  background:
                    "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                  backgroundSize: "800px 100%",
                  animation: "gf-shimmer 1.8s ease-in-out infinite",
                }}
              />
              <div className="flex-1" />
              <div
                className="h-4 w-24 rounded"
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
      </div>
    </>
  );
}
