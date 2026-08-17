const testCase = process.env.MOCK_ENCORE_DATA_CASE ?? "safe";

function jsonResponse(value, contentType = "application/json") {
  const body = typeof value === "string" ? value : JSON.stringify(value);
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": contentType,
      "content-length": String(Buffer.byteLength(body)),
    },
  });
}

function lists(pathname) {
  if (pathname === "/api/en/character") {
    if (testCase === "dangerous-key") {
      return jsonResponse('{"roleList":[{"Id":1,"__proto__":{"polluted":true}}]}');
    }
    if (testCase === "duplicate-id") {
      return jsonResponse({ roleList: [{ Id: 1 }, { Id: 1 }] });
    }
    if (testCase === "missing-character") return jsonResponse({ roleList: [] });
    return jsonResponse({
      roleList: [
        {
          Id: 1,
          Name: "Security Fixture Character",
          RoleHeadIcon: "https://cdn.encore.moe/character.png",
          Advertisement: { Image: "https://evil.example/never-follow-me.png" },
        },
      ],
    });
  }
  if (pathname === "/api/en/weapon") {
    return jsonResponse({ weapons: [{ Id: 2, Name: "Security Fixture Weapon" }] });
  }
  if (pathname === "/api/en/echo") {
    return jsonResponse({ Echo: [{ Id: 3, Name: "Security Fixture Echo" }] });
  }
  return null;
}

function detail(pathname) {
  if (pathname === "/api/en/character/1") {
    return jsonResponse({
      Id: 1,
      Name: "Security Fixture Character",
      Description: "A safe character description used to map textual Encore fields.",
      Skills: [
        {
          Name: "Basic Attack",
          Description: "Perform a sequence of attacks and deal damage.",
          Multiplier: 123.45,
        },
      ],
      Nested: { Value: 123, Enabled: true },
      ExternalGuide: "https://evil.example/tracker?user=123",
      HtmlSnippet: "<b>formatted source text</b>",
      ScriptSnippet: "<script>alert('never execute')</script>",
    });
  }
  if (pathname === "/api/en/weapon/2") {
    return jsonResponse({
      Id: 2,
      Name: "Security Fixture Weapon",
      Passive: {
        Name: "Fixture Passive",
        Description: "Increase a stat after a reviewed condition.",
      },
      Stats: [{ Level: 90, Value: 500 }],
    });
  }
  if (pathname === "/api/en/echo/3") {
    return jsonResponse({
      Id: 3,
      Name: "Security Fixture Echo",
      Cost: 4,
      SkillDescription: "Transform into the fixture Echo and deal damage.",
      Sonata: [{ Id: 99, Name: "Fixture Sonata" }],
    });
  }
  return null;
}

globalThis.fetch = async (input, options = {}) => {
  const raw = typeof input === "string" || input instanceof URL ? String(input) : input?.url;
  const url = new URL(raw);

  if (url.origin !== "https://api-v2.encore.moe") {
    throw new Error(`Importer followed an untrusted URL: ${url.toString()}`);
  }
  if (url.searchParams.get("v") !== "Release" || [...url.searchParams.keys()].length !== 1) {
    throw new Error(`Importer requested a non-Release or unexpected query: ${url.toString()}`);
  }
  if (options.method !== "GET") throw new Error("Importer must use GET only");
  if (options.redirect !== "error") throw new Error("Importer must disable redirects");
  if (options.headers?.Accept !== "application/json") throw new Error("Importer must request JSON only");

  if (testCase === "bad-content-type" && url.pathname === "/api/en/character") {
    return jsonResponse("<html>ad</html>", "text/html");
  }

  return lists(url.pathname) ?? detail(url.pathname) ?? new Response("not found", { status: 404 });
};
