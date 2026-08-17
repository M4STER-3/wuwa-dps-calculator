const testCase = process.env.MOCK_ENCORE_CASE ?? "safe";

const pngBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const badImageBytes = Buffer.from("not-a-real-png", "utf8");

function jsonResponse(value) {
  const body = JSON.stringify(value);
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/json",
      "content-length": String(Buffer.byteLength(body)),
    },
  });
}

function imageResponse(url) {
  if (testCase === "optional-404" && url.pathname.includes("character-detail")) {
    return new Response("not found", { status: 404 });
  }
  if (testCase === "required-404" && url.pathname === "/character.png") {
    return new Response("not found", { status: 404 });
  }

  const bytes =
    (testCase === "bad-image" && url.pathname.includes("character")) ||
    url.pathname.includes("advertisement")
      ? badImageBytes
      : pngBytes;
  return new Response(bytes, {
    status: 200,
    headers: {
      "content-type": "image/png",
      "content-length": String(bytes.length),
    },
  });
}

function characterList() {
  return {
    roleList: [
      {
        Id: testCase === "dangerous-id" ? "__proto__" : 1,
        Name: "Security Fixture Character",
        RoleHeadIcon: "https://cdn.encore.moe/character.png",
        Advertisement: {
          Image: "https://cdn.encore.moe/advertisement.png",
        },
      },
    ],
  };
}

function weaponList() {
  return {
    weapons: [
      {
        Id: 2,
        Name: "Security Fixture Weapon",
        Icon: "https://cdn.encore.moe/weapon.png",
      },
    ],
  };
}

function echoList() {
  return {
    Echo: [
      {
        Id: 3,
        Name: "Security Fixture Echo",
        Icon: "https://cdn.encore.moe/echo.png",
      },
    ],
  };
}

globalThis.fetch = async (input) => {
  const raw = typeof input === "string" || input instanceof URL ? String(input) : input?.url;
  const url = new URL(raw);

  if (url.hostname === "api-v2.encore.moe") {
    if (url.pathname === "/api/en/character") return jsonResponse(characterList());
    if (url.pathname === "/api/en/weapon") return jsonResponse(weaponList());
    if (url.pathname === "/api/en/echo") return jsonResponse(echoList());
    if (url.pathname === "/api/en/character/1") {
      return jsonResponse({ RolePortrait: "https://cdn.encore.moe/character-detail.png" });
    }
    if (url.pathname === "/api/en/weapon/2") {
      return jsonResponse({ Icon: "https://cdn.encore.moe/weapon-detail.png" });
    }
    if (url.pathname === "/api/en/echo/3") {
      return jsonResponse({ PreviewImage: "https://cdn.encore.moe/echo-detail.png" });
    }
    return new Response("not found", { status: 404 });
  }

  if (url.hostname === "cdn.encore.moe") return imageResponse(url);
  throw new Error(`Unexpected mocked fetch target: ${url.toString()}`);
};
