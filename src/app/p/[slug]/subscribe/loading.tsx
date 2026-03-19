export default function SubscribePageLoading() {
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
          <div className="mx-auto flex max-w-3xl items-center gap-2.5 px-6 py-4">
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
        </header>

        {/* Subscribe form skeleton */}
        <main className="mx-auto max-w-md px-6 py-16">
          <div style={{ animation: "gf-fade-up 0.4s ease-out 100ms both" }}>
            {/* Title */}
            <div
              className="mx-auto mb-2 h-6 w-48 rounded"
              style={{
                background:
                  "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                backgroundSize: "800px 100%",
                animation: "gf-shimmer 1.8s ease-in-out infinite",
              }}
            />
            {/* Subtitle */}
            <div
              className="mx-auto mb-8 h-4 w-64 rounded"
              style={{
                background:
                  "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                backgroundSize: "800px 100%",
                animation: "gf-shimmer 1.8s ease-in-out infinite",
              }}
            />
            {/* Card */}
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              {/* Lock icon */}
              <div className="mb-5 text-center">
                <div
                  className="mx-auto mb-3 h-10 w-10 rounded-lg"
                  style={{
                    background:
                      "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                    backgroundSize: "800px 100%",
                    animation: "gf-shimmer 1.8s ease-in-out infinite",
                  }}
                />
                {/* Price */}
                <div
                  className="mx-auto mb-1 h-5 w-32 rounded"
                  style={{
                    background:
                      "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                    backgroundSize: "800px 100%",
                    animation: "gf-shimmer 1.8s ease-in-out infinite",
                  }}
                />
                {/* Description */}
                <div
                  className="mx-auto h-3 w-48 rounded"
                  style={{
                    background:
                      "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                    backgroundSize: "800px 100%",
                    animation: "gf-shimmer 1.8s ease-in-out infinite",
                  }}
                />
              </div>
              {/* Email input */}
              <div
                className="mb-2.5 h-11 w-full rounded-lg"
                style={{
                  background:
                    "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                  backgroundSize: "800px 100%",
                  animation: "gf-shimmer 1.8s ease-in-out infinite",
                }}
              />
              {/* Name input */}
              <div
                className="mb-4 h-11 w-full rounded-lg"
                style={{
                  background:
                    "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 20%, #f1f5f9 40%, #f1f5f9 100%)",
                  backgroundSize: "800px 100%",
                  animation: "gf-shimmer 1.8s ease-in-out infinite",
                }}
              />
              {/* Button */}
              <div
                className="h-11 w-full rounded-lg"
                style={{
                  background:
                    "linear-gradient(90deg, #e2e8f0 0%, #cbd5e1 20%, #e2e8f0 40%, #e2e8f0 100%)",
                  backgroundSize: "800px 100%",
                  animation: "gf-shimmer 1.8s ease-in-out infinite",
                }}
              />
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
