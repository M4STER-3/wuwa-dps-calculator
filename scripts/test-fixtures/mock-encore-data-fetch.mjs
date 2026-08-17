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

function characterDetail() {
  const skillDescribe =
    testCase === "unsafe-normalizer-text"
      ? "<script>alert('do not run')</script>"
      : testCase === "normalizer-url-text"
        ? "Read https://evil.example/advertisement for more damage."
        : "Deal <color=#ff0000>Fusion DMG</color> to the target.";

  return {
    Id: 1,
    Name: { Content: "Security Fixture Character", Title: "No Description Available" },
    Description: "A safe character description used to map textual Encore fields.",
    ElementId: 2,
    ElementName: "Fusion",
    WeaponType: 2,
    WeaponTypeName: "Sword",
    QualityId: 5,
    MaxLevel: 90,
    Properties: [
      {
        Name: "ATK",
        BaseValue: 100,
        GrowthValues: [
          { growthId: 1, level: 1, value: 100 },
          { growthId: 2, level: 2, value: 110.5 },
        ],
      },
    ],
    Skills: [
      {
        SkillId: 101,
        SkillName: "Basic Attack",
        SkillType: "Basic Attack",
        SkillDescribe: skillDescribe,
        Description: "Perform a sequence of attacks and deal damage.",
        Multiplier: 123.45,
        SkillAttributes: [
          {
            attributeId: 900001,
            attributeName: "Basic Attack Damage",
            Description: "ATK",
            values: ["100%", "110%"],
          },
        ],
      },
    ],
    ResonantChain: Array.from({ length: 6 }, (_, index) => ({
      GroupIndex: index + 1,
      Id: index + 1,
      NodeName: `Fixture Sequence ${index + 1}`,
      AttributesDescription: `Sequence ${index + 1} <color=#fff>description</color>.`,
    })),
    SkillTree: [
      {
        Id: 501,
        PropertyNodeTitle: "ATK+",
        PropertyNodeDescribe: "ATK increased by 1.80%.",
      },
    ],
    Nested: { Value: 123, Enabled: true },
    ExternalGuide: "https://evil.example/tracker?user=123",
    HtmlSnippet: "<b>formatted source text</b>",
    ScriptSnippet: "<script>alert('never execute')</script>",
  };
}

function weaponDetail() {
  return {
    Id: 2,
    ItemId: 2,
    Name: "Security Fixture Weapon",
    WeaponName: "Security Fixture Weapon",
    WeaponType: 2,
    WeaponTypeName: "Sword",
    QualityId: 5,
    AttributesDescription: "A fixture weapon used for reviewed normalization tests.",
    ResonName: "Fixture Passive",
    Desc: "Increase <color=#fff>ATK</color> by {0} after a reviewed condition.",
    DescParams: [
      { ArrayString: ["10%"] },
      { ArrayString: ["12.5%"] },
      { ArrayString: ["15%"] },
      { ArrayString: ["17.5%"] },
      { ArrayString: ["20%"] },
    ],
    Passive: {
      Name: "Fixture Passive",
      Description: "Increase a stat after a reviewed condition.",
    },
    Properties: [
      {
        Name: "ATK",
        BaseValue: 40,
        GrowthValues: [
          { Level: 1, Value: "40" },
          { Level: 2, Value: "43" },
        ],
      },
      {
        Name: "Crit. Rate",
        BaseValue: 0.08,
        GrowthValues: [
          { Level: 1, Value: "8%" },
          { Level: 2, Value: "8.5%" },
        ],
      },
    ],
    Breaches: [
      { Level: 0, LevelLimit: 20 },
      { Level: 6, LevelLimit: 90 },
    ],
    Stats: [{ Level: 90, Value: 500 }],
  };
}

function echoDetail() {
  return {
    Id: 3,
    MonsterId: 3,
    Name: "Security Fixture Echo",
    MonsterName: "Security Fixture Echo",
    Cost: 4,
    Element: { Id: 2, Name: "Fusion" },
    QualityId: 5,
    Rarity: 3,
    LevelUpGroupId: 4,
    Handbook: { Intensity: "Overlord Class" },
    Skill: {
      Id: 301,
      SimplyDescription: "Transform into the fixture Echo and deal Fusion DMG.",
      DescriptionEx: "Transform and deal <color=#fff>Fusion DMG</color>.",
      SkillCD: 20,
    },
    SkillDescription: "Transform into the fixture Echo and deal damage.",
    FetterGroup: [1],
    FetterDetails: {
      "Molten Rift": {
        EffectKeys: [2, 5],
        EffectDescriptions: [
          "Fusion DMG + 10%.",
          "Fusion DMG + 30% for 15s after releasing Resonance Skill.",
        ],
        DefineDescriptions: ["A fixture Sonata definition."],
      },
    },
    Sonata: [{ Id: 99, Name: "Fixture Sonata" }],
  };
}

function detail(pathname) {
  if (pathname === "/api/en/character/1") return jsonResponse(characterDetail());
  if (pathname === "/api/en/weapon/2") return jsonResponse(weaponDetail());
  if (pathname === "/api/en/echo/3") return jsonResponse(echoDetail());
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
