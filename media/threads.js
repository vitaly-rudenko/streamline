// @ts-nocheck

mermaid.initialize({
  theme: 'dark',
  securityLevel: 'loose',
  flowchart: {
    diagramPadding: 500,
    nodeSpacing: 20,
    rankSpacing: 15,
    curve: 'linear',
    useWidth: false,
    useMaxWidth: false,
    defaultRenderer: 'elk',
  },
})

window.handleNodeClick = (nodeId) => {
  console.log(nodeId)

  const element = window.document.querySelector(`g[data-id="${nodeId}"]`)
  if (element) {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center',
    })
  }
}
