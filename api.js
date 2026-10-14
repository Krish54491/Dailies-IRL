// Shared by the popup and options page
const DEPLOYMENT_ID =
  "AKfycbz8696av5ojKcdSzupS6hsHk79KwxIX7l7sih5eLGDzBhU8nUj8OgR1PeWEnSn5QmFm";

// Calls an Apps Script function through the Apps Script API and returns its result
async function runScript(fn, parameters = [], retried = false) {
  const { token } = await chrome.identity.getAuthToken({ interactive: true });
  const res = await fetch(
    `https://script.googleapis.com/v1/scripts/${DEPLOYMENT_ID}:run`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ function: fn, parameters }),
    },
  );
  if (res.status === 401 && !retried) {
    // stale token, drop it and retry once
    await chrome.identity.removeCachedAuthToken({ token });
    return runScript(fn, parameters, true);
  }
  const body = await res.json();
  if (!res.ok) throw new Error(`${res.status}: ${body.error?.message}`);
  // a script that throws still returns HTTP 200, with the error in the body
  if (body.error) {
    throw new Error(body.error.details?.[0]?.errorMessage ?? "Script error");
  }
  return body.response?.result;
}
