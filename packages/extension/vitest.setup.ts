// happy-dom no calcula layout real: getBoundingClientRect() devuelve todo a
// cero por defecto. Se simula un rect no-nulo para que isVisible() en el
// extractor pueda evaluarse en los tests sin un motor de layout.
Element.prototype.getBoundingClientRect = function getBoundingClientRect(): DOMRect {
  return {
    width: 100,
    height: 20,
    top: 0,
    left: 0,
    bottom: 20,
    right: 100,
    x: 0,
    y: 0,
    toJSON() {
      return this;
    },
  };
};
