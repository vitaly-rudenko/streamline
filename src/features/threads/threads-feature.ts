import * as vscode from 'vscode'

class ThreadsWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'streamline.threads'

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    }

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview)
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'threads.js')
    )

    const stylesUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'threads.css')
    )

    return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'unsafe-inline' 'unsafe-eval' vscode-resource: data: https: http:;">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link rel="stylesheet" href="${stylesUri}"></link>

				<title>Threads</title>
			</head>
			<body>
				<div class="mermaid">
flowchart TD
classDef suggestion font-size:10px,fill:#0000,stroke-dasharray:5 5
classDef inactive font-size:10px,fill:#0000
classDef active font-size:10px
click 1 call handleNodeClick()
1[orders/get-entry.js]:::active --- 2[receipts/process-info.js]:::active & 7[users/process-info.js]:::inactive & 62[orders/create-record.js]:::inactive & 70[users/get-item.js]:::inactive & 84[users/get-record.js]:::inactive & 104[delete-data.js]:::inactive & 111[update-data.js]:::inactive & 115[process-item.js]:::inactive
click 2 call handleNodeClick()
2[receipts/process-info.js]:::active --- 3[users/process-data.js]:::active & 41[users/get-record.js]:::inactive & 44[users/get-data.js]:::inactive & 133[process-item.js]:::inactive
click 3 call handleNodeClick()
3[users/process-data.js]:::active --- 4[create-entry.js]:::inactive & 29[users/create-record.js]:::inactive & 150[orders/delete-record.js]:::active
click 4 call handleNodeClick()
4[create-entry.js]:::active --- 5[orders/create-record.js]:::inactive
click 5 call handleNodeClick()
5[orders/create-record.js]:::active --- 6[process-item.js]:::inactive & 15[products/create-data.js]:::inactive
click 6 call handleNodeClick()
6[process-item.js]:::inactive
click 15 call handleNodeClick()
15[products/create-data.js]:::active --- 16[get-item.js]:::inactive & 18[users/get-record.js]:::inactive
click 16 call handleNodeClick()
16[get-item.js]:::active --- 17[orders/delete-record.js]:::inactive
click 17 call handleNodeClick()
17[orders/delete-record.js]:::inactive
click 18 call handleNodeClick()
18[users/get-record.js]:::active --- 19[users/get-data.js]:::inactive
click 19 call handleNodeClick()
19[users/get-data.js]:::active --- 20[orders/get-info.js]:::inactive & 26[users/process-info.js]:::inactive
click 20 call handleNodeClick()
20[orders/get-info.js]:::active --- 21[update-data.js]:::inactive
click 21 call handleNodeClick()
21[update-data.js]:::active --- 22[process-item.js]:::inactive
click 22 call handleNodeClick()
22[process-item.js]:::active --- 23[receipts/get-data.js]:::inactive
click 23 call handleNodeClick()
23[receipts/get-data.js]:::active --- 24[get-item.js]:::inactive
click 24 call handleNodeClick()
24[get-item.js]:::active --- 25[invoices/update-record.js]:::inactive
click 25 call handleNodeClick()
25[invoices/update-record.js]:::inactive
click 26 call handleNodeClick()
26[users/process-info.js]:::active --- 27[update-record.js]:::inactive
click 27 call handleNodeClick()
27[update-record.js]:::active --- 28[orders/delete-record.js]:::inactive
click 28 call handleNodeClick()
28[orders/delete-record.js]:::inactive
click 29 call handleNodeClick()
29[users/create-record.js]:::active --- 30[delete-data.js]:::inactive
click 30 call handleNodeClick()
30[delete-data.js]:::active --- 31[update-record.js]:::inactive
click 31 call handleNodeClick()
31[update-record.js]:::active --- 32[update-data.js]:::inactive
click 32 call handleNodeClick()
32[update-data.js]:::active --- 33[get-item.js]:::inactive
click 33 call handleNodeClick()
33[get-item.js]:::active --- 34[create-entry.js]:::inactive
click 34 call handleNodeClick()
34[create-entry.js]:::active --- 35[users/get-data.js]:::inactive
click 35 call handleNodeClick()
35[users/get-data.js]:::active --- 36[users/get-item.js]:::inactive
click 36 call handleNodeClick()
36[users/get-item.js]:::active --- 37[process-item.js]:::inactive
click 37 call handleNodeClick()
37[process-item.js]:::active --- 38[invoices/update-record.js]:::inactive
click 38 call handleNodeClick()
38[invoices/update-record.js]:::active --- 39[orders/create-record.js]:::inactive
click 39 call handleNodeClick()
39[orders/create-record.js]:::active --- 40[invoices/get-info.js]:::inactive
click 40 call handleNodeClick()
40[invoices/get-info.js]:::inactive
click 150 call handleNodeClick()
150[orders/delete-record.js]:::active --- 151[users/get-item.js]:::active
click 151 call handleNodeClick()
151[users/get-item.js]:::active --- 152[users/process-info.js]:::active
click 152 call handleNodeClick()
152[users/process-info.js]:::active --- 153[users/create-record.js]:::active
click 153 call handleNodeClick()
153[users/create-record.js]:::active
click 41 call handleNodeClick()
41[users/get-record.js]:::active --- 42[update-record.js]:::inactive & 140[products/create-data.js]:::inactive & 146[update-record.js]:::inactive
click 42 call handleNodeClick()
42[update-record.js]:::active --- 43[users/create-record.js]:::inactive
click 43 call handleNodeClick()
43[users/create-record.js]:::inactive
click 140 call handleNodeClick()
140[products/create-data.js]:::active --- 141[users/get-data.js]:::inactive
click 141 call handleNodeClick()
141[users/get-data.js]:::active --- 142[users/process-data.js]:::inactive
click 142 call handleNodeClick()
142[users/process-data.js]:::active --- 143[orders/delete-record.js]:::inactive
click 143 call handleNodeClick()
143[orders/delete-record.js]:::active --- 144[create-data.js]:::inactive
click 144 call handleNodeClick()
144[create-data.js]:::active --- 145[users/create-record.js]:::inactive
click 145 call handleNodeClick()
145[users/create-record.js]:::inactive
click 146 call handleNodeClick()
146[update-record.js]:::active --- 147[users/process-info.js]:::inactive
click 147 call handleNodeClick()
147[users/process-info.js]:::active --- 148[delete-item.js]:::inactive
click 148 call handleNodeClick()
148[delete-item.js]:::inactive
click 44 call handleNodeClick()
44[users/get-data.js]:::active --- 45[get-item.js]:::inactive & 48[process-item.js]:::inactive
click 45 call handleNodeClick()
45[get-item.js]:::active --- 46[receipts/get-data.js]:::inactive
click 46 call handleNodeClick()
46[receipts/get-data.js]:::active --- 47[orders/create-record.js]:::inactive
click 47 call handleNodeClick()
47[orders/create-record.js]:::inactive
click 48 call handleNodeClick()
48[process-item.js]:::active --- 49[users/create-record.js]:::inactive & 61[orders/delete-record.js]:::inactive
click 49 call handleNodeClick()
49[users/create-record.js]:::active --- 50[invoices/get-info.js]:::inactive
click 50 call handleNodeClick()
50[invoices/get-info.js]:::active --- 51[delete-data.js]:::inactive & 56[update-record.js]:::inactive
click 51 call handleNodeClick()
51[delete-data.js]:::active --- 52[create-entry.js]:::inactive
click 52 call handleNodeClick()
52[create-entry.js]:::active --- 53[orders/get-info.js]:::inactive
click 53 call handleNodeClick()
53[orders/get-info.js]:::active --- 54[users/process-data.js]:::inactive
click 54 call handleNodeClick()
54[users/process-data.js]:::active --- 55[delete-item.js]:::inactive
click 55 call handleNodeClick()
55[delete-item.js]:::inactive
click 56 call handleNodeClick()
56[update-record.js]:::active --- 57[products/delete-item.js]:::inactive
click 57 call handleNodeClick()
57[products/delete-item.js]:::active --- 58[orders/get-info.js]:::inactive
click 58 call handleNodeClick()
58[orders/get-info.js]:::active --- 59[orders/delete-record.js]:::inactive
click 59 call handleNodeClick()
59[orders/delete-record.js]:::active --- 60[get-item.js]:::inactive
click 60 call handleNodeClick()
60[get-item.js]:::inactive
click 61 call handleNodeClick()
61[orders/delete-record.js]:::inactive
click 133 call handleNodeClick()
133[process-item.js]:::active --- 134[invoices/update-record.js]:::inactive & 138[orders/create-record.js]:::inactive
click 134 call handleNodeClick()
134[invoices/update-record.js]:::active --- 135[update-record.js]:::inactive
click 135 call handleNodeClick()
135[update-record.js]:::active --- 136[users/get-data.js]:::inactive
click 136 call handleNodeClick()
136[users/get-data.js]:::active --- 137[invoices/get-info.js]:::inactive
click 137 call handleNodeClick()
137[invoices/get-info.js]:::inactive
click 138 call handleNodeClick()
138[orders/create-record.js]:::active --- 139[users/process-info.js]:::inactive
click 139 call handleNodeClick()
139[users/process-info.js]:::inactive
click 7 call handleNodeClick()
7[users/process-info.js]:::active --- 8[users/get-data.js]:::inactive
click 8 call handleNodeClick()
8[users/get-data.js]:::active --- 9[update-record.js]:::inactive
click 9 call handleNodeClick()
9[update-record.js]:::active --- 10[update-record.js]:::inactive
click 10 call handleNodeClick()
10[update-record.js]:::active --- 11[users/get-item.js]:::inactive
click 11 call handleNodeClick()
11[users/get-item.js]:::active --- 12[orders/create-record.js]:::inactive
click 12 call handleNodeClick()
12[orders/create-record.js]:::active --- 13[update-data.js]:::inactive
click 13 call handleNodeClick()
13[update-data.js]:::active --- 14[orders/delete-record.js]:::inactive
click 14 call handleNodeClick()
14[orders/delete-record.js]:::inactive
click 62 call handleNodeClick()
62[orders/create-record.js]:::active --- 63[invoices/get-info.js]:::inactive
click 63 call handleNodeClick()
63[invoices/get-info.js]:::active --- 64[orders/get-info.js]:::inactive
click 64 call handleNodeClick()
64[orders/get-info.js]:::active --- 65[receipts/get-data.js]:::inactive
click 65 call handleNodeClick()
65[receipts/get-data.js]:::active --- 66[users/process-info.js]:::inactive
click 66 call handleNodeClick()
66[users/process-info.js]:::active --- 67[orders/delete-record.js]:::inactive
click 67 call handleNodeClick()
67[orders/delete-record.js]:::active --- 68[invoices/update-record.js]:::inactive
click 68 call handleNodeClick()
68[invoices/update-record.js]:::active --- 69[users/create-record.js]:::inactive
click 69 call handleNodeClick()
69[users/create-record.js]:::inactive
click 70 call handleNodeClick()
70[users/get-item.js]:::active --- 71[update-data.js]:::inactive & 79[invoices/get-info.js]:::inactive
click 71 call handleNodeClick()
71[update-data.js]:::active --- 72[orders/create-record.js]:::inactive
click 72 call handleNodeClick()
72[orders/create-record.js]:::active --- 73[update-record.js]:::inactive & 77[orders/create-record.js]:::inactive
click 73 call handleNodeClick()
73[update-record.js]:::active --- 74[receipts/process-info.js]:::inactive
click 74 call handleNodeClick()
74[receipts/process-info.js]:::active --- 75[orders/get-info.js]:::inactive
click 75 call handleNodeClick()
75[orders/get-info.js]:::active --- 76[users/get-data.js]:::inactive
click 76 call handleNodeClick()
76[users/get-data.js]:::inactive
click 77 call handleNodeClick()
77[orders/create-record.js]:::active --- 78[update-record.js]:::inactive
click 78 call handleNodeClick()
78[update-record.js]:::inactive
click 79 call handleNodeClick()
79[invoices/get-info.js]:::active --- 80[products/delete-item.js]:::inactive
click 80 call handleNodeClick()
80[products/delete-item.js]:::active --- 81[users/get-data.js]:::inactive
click 81 call handleNodeClick()
81[users/get-data.js]:::active --- 82[users/create-record.js]:::inactive
click 82 call handleNodeClick()
82[users/create-record.js]:::active --- 83[process-item.js]:::inactive
click 83 call handleNodeClick()
83[process-item.js]:::inactive
click 84 call handleNodeClick()
84[users/get-record.js]:::active --- 85[delete-item.js]:::inactive & 149[users/process-info.js]:::inactive
click 85 call handleNodeClick()
85[delete-item.js]:::active --- 86[users/create-record.js]:::inactive & 98[create-data.js]:::inactive
click 86 call handleNodeClick()
86[users/create-record.js]:::active --- 87[orders/create-record.js]:::inactive & 97[users/get-data.js]:::inactive
click 87 call handleNodeClick()
87[orders/create-record.js]:::active --- 88[users/get-item.js]:::inactive
click 88 call handleNodeClick()
88[users/get-item.js]:::active --- 89[users/process-info.js]:::inactive & 93[products/create-data.js]:::inactive
click 89 call handleNodeClick()
89[users/process-info.js]:::active --- 90[orders/delete-record.js]:::inactive
click 90 call handleNodeClick()
90[orders/delete-record.js]:::active --- 91[users/get-data.js]:::inactive
click 91 call handleNodeClick()
91[users/get-data.js]:::active --- 92[users/process-data.js]:::inactive
click 92 call handleNodeClick()
92[users/process-data.js]:::inactive
click 93 call handleNodeClick()
93[products/create-data.js]:::active --- 94[invoices/get-info.js]:::inactive
click 94 call handleNodeClick()
94[invoices/get-info.js]:::active --- 95[orders/get-info.js]:::inactive
click 95 call handleNodeClick()
95[orders/get-info.js]:::active --- 96[create-data.js]:::inactive
click 96 call handleNodeClick()
96[create-data.js]:::inactive
click 97 call handleNodeClick()
97[users/get-data.js]:::inactive
click 98 call handleNodeClick()
98[create-data.js]:::active --- 99[process-item.js]:::inactive
click 99 call handleNodeClick()
99[process-item.js]:::active --- 100[update-record.js]:::inactive
click 100 call handleNodeClick()
100[update-record.js]:::active --- 101[users/get-data.js]:::inactive
click 101 call handleNodeClick()
101[users/get-data.js]:::active --- 102[products/create-data.js]:::inactive
click 102 call handleNodeClick()
102[products/create-data.js]:::active --- 103[receipts/get-data.js]:::inactive
click 103 call handleNodeClick()
103[receipts/get-data.js]:::inactive
click 149 call handleNodeClick()
149[users/process-info.js]:::inactive
click 104 call handleNodeClick()
104[delete-data.js]:::active --- 105[orders/create-record.js]:::inactive
click 105 call handleNodeClick()
105[orders/create-record.js]:::active --- 106[update-record.js]:::inactive & 109[users/get-item.js]:::inactive
click 106 call handleNodeClick()
106[update-record.js]:::active --- 107[process-item.js]:::inactive
click 107 call handleNodeClick()
107[process-item.js]:::active --- 108[products/create-data.js]:::inactive
click 108 call handleNodeClick()
108[products/create-data.js]:::inactive
click 109 call handleNodeClick()
109[users/get-item.js]:::active --- 110[receipts/get-data.js]:::inactive
click 110 call handleNodeClick()
110[receipts/get-data.js]:::inactive
click 111 call handleNodeClick()
111[update-data.js]:::active --- 112[delete-item.js]:::inactive
click 112 call handleNodeClick()
112[delete-item.js]:::active --- 113[invoices/update-record.js]:::inactive
click 113 call handleNodeClick()
113[invoices/update-record.js]:::active --- 114[orders/delete-record.js]:::inactive
click 114 call handleNodeClick()
114[orders/delete-record.js]:::inactive
click 115 call handleNodeClick()
115[process-item.js]:::active --- 116[delete-item.js]:::inactive & 132[orders/create-record.js]:::inactive
click 116 call handleNodeClick()
116[delete-item.js]:::active --- 117[invoices/update-record.js]:::inactive
click 117 call handleNodeClick()
117[invoices/update-record.js]:::active --- 118[orders/delete-record.js]:::inactive
click 118 call handleNodeClick()
118[orders/delete-record.js]:::active --- 119[users/get-record.js]:::inactive & 125[delete-data.js]:::inactive
click 119 call handleNodeClick()
119[users/get-record.js]:::active --- 120[create-data.js]:::inactive
click 120 call handleNodeClick()
120[create-data.js]:::active --- 121[users/create-record.js]:::inactive
click 121 call handleNodeClick()
121[users/create-record.js]:::active --- 122[receipts/get-data.js]:::inactive
click 122 call handleNodeClick()
122[receipts/get-data.js]:::active --- 123[products/create-data.js]:::inactive
click 123 call handleNodeClick()
123[products/create-data.js]:::active --- 124[create-entry.js]:::inactive
click 124 call handleNodeClick()
124[create-entry.js]:::inactive
click 125 call handleNodeClick()
125[delete-data.js]:::active --- 126[orders/get-info.js]:::inactive
click 126 call handleNodeClick()
126[orders/get-info.js]:::active --- 127[users/process-info.js]:::inactive
click 127 call handleNodeClick()
127[users/process-info.js]:::active --- 128[create-data.js]:::inactive & 130[get-item.js]:::inactive
click 128 call handleNodeClick()
128[create-data.js]:::active --- 129[products/delete-item.js]:::inactive
click 129 call handleNodeClick()
129[products/delete-item.js]:::inactive
click 130 call handleNodeClick()
130[get-item.js]:::active --- 131[invoices/get-info.js]:::inactive
click 131 call handleNodeClick()
131[invoices/get-info.js]:::inactive
click 132 call handleNodeClick()
132[orders/create-record.js]:::inactive
153[users/create-record.js]:::active -.- 154[update-entry.js]:::suggestion -.- 155[users/get-item.js]:::suggestion -.- 156[create-info.js]:::suggestion
        </div>

				<script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js"></script>
				<script src="${scriptUri}"></script>
			</body>
			</html>`
  }
}

export function createThreadsFeature(input: {
  context: vscode.ExtensionContext
}) {
  const { context } = input

  const threadsWebviewProvider = new ThreadsWebviewProvider(context.extensionUri)

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'streamline.threads',
      threadsWebviewProvider
    )
  )
}
