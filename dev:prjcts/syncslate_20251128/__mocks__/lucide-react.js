// Mock for lucide-react icons
const MockIcon = () => null;

module.exports = new Proxy({}, {
  get: () => MockIcon
});