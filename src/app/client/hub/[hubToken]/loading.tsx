export default function ClientHubLoading() {
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
        <header className="border-b border-gray-200 bg-white px-6 py-4">
          <div className="mx-auto flex max-w-4xl items-center gap-4">
            <div
              className="h-8 w-8 rounded-lg"
              style={{
                background:
                  "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                backgroundSize: "800px 100%",
                animation: "gf-shimmer 1.8s ease-in-out infinite",
              }}
            />
            <div>
              <div
                className="mb-1 h-3 w-24 rounded"
                style={{
                  background:
                    "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                  backgroundSize: "800px 100%",
                  animation: "gf-shimmer 1.8s ease-in-out infinite",
                }}
              />
              <div
                className="h-5 w-40 rounded"
                style={{
                  background:
                    "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                  backgroundSize: "800px 100%",
                  animation: "gf-shimmer 1.8s ease-in-out infinite",
                }}
              />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-4xl px-6 py-10">
          {/* Title skeleton */}
          <div className="mb-6">
            <div
              className="mb-2 h-6 w-48 rounded"
              style={{
                background:
                  "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                backgroundSize: "800px 100%",
                animation: "gf-shimmer 1.8s ease-in-out infinite",
              }}
            />
            <div
              className="h-4 w-72 rounded"
              style={{
                background:
                  "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                backgroundSize: "800px 100%",
                animation: "gf-shimmer 1.8s ease-in-out infinite",
              }}
            />
          </div>

          {/* Portal card grid skeleton */}
          <div className="grid gap-4 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-gray-200 bg-white p-5"
                style={{
                  borderTopWidth: 3,
                  borderTopColor: "#e2e8f0",
                  animation: `gf-fade-up 0.4s ease-out ${i * 80}ms both`,
                }}
              >
                <div
                  className="mb-2 h-3 w-20 rounded"
                  style={{
                    background:
                      "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                    backgroundSize: "800px 100%",
                    animation: "gf-shimmer 1.8s ease-in-out infinite",
                  }}
                />
                <div
                  className="mb-3 h-5 w-44 rounded"
                  style={{
                    background:
                      "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                    backgroundSize: "800px 100%",
                    animation: "gf-shimmer 1.8s ease-in-out infinite",
                  }}
                />
                <div
                  className="h-3 w-full rounded"
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
        </main>
      </div>
    </>
  );
}
