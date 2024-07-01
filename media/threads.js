// @ts-nocheck

mermaid.initialize({
  startOnLoad: true,
  securityLevel: 'loose',
  flowchart: {
    useWidth: false,
    useMaxWidth: false,
  }
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
