# Smart Config

Smart Config allows you to create configuration presets and apply them when certain conditions are met.

## Configuration presets

Start with creating configuration presets:
```jsonc
{
  "streamline.smartConfig.defaults": {
    "github.copilot.editor.enableAutoCompletions": false,
    "editor.fontSize": 14
  },
  "streamline.smartConfig.configs": {
    "Copilot": {
      "github.copilot.editor.enableAutoCompletions": true
    },
    "Large font": {
      "editor.fontSize": 18
    }
  }
}
```

> Make sure to set add default values to `streamline.smartConfig.defaults` so that extension knows which values to use when presets are not applied.

## Custom toggles

You can create custom toggles in the status bar:
```jsonc
{
  "streamline.smartConfig.toggles": ["AI", "Reading mode"]
}
```

[Icons](https://code.visualstudio.com/api/references/icons-in-labels) can also be used:
```jsonc
{
  "streamline.smartConfig.toggles": ["$(copilot)", "$(eye) Reading mode"]
}
```

## Rules

Now that you have `Large font` and `Copilot` presets, you can define rules for them to be applied.  

Each rule contains:
- List of configuration presets to apply
- List of conditions which are used to determine whether the rule should be applied

Example:
```jsonc
{
  "streamline.smartConfig.rules": [
    {
      "apply": ["Reading mode"],
      // ^ presets to apply
      "when": [{ "languageId": "markdown" }]
      // ^ conditions
    },
    {
      "apply": ["Copilot"],
      "when": [
        { "path": "\\.(test|spec|e2e-spec)\\.(js|ts)$" },
        { "untitled": true, "languageId": ["javascript", "typescript"] },
        { "toggle": "AI" }
      ]
      // ^ when "path matches regex"
      //     OR ("file is untitled" AND ("language is javascript" OR "language is typescript"))
      //     OR "AI toggle is enabled"
    }
  ],
}
```

> Run `Streamline: Open Help for 'when' Syntax` command to show all possible conditions and examples for `"when"` field.
