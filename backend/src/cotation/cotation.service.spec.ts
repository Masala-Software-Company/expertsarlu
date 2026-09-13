import { calculerAssurance } from './cotation.service';

describe('calculerAssurance', () => {
  it('applique 7$/jour pour J ≤ 30', () => {
    expect(calculerAssurance(10)).toEqual({
      jours: 10,
      tarifApplique: 7,
      montantTotal: 70,
    });
    expect(calculerAssurance(30)).toEqual({
      jours: 30,
      tarifApplique: 7,
      montantTotal: 210,
    });
  });

  it('applique 6.50$/jour pour J ≥ 31', () => {
    expect(calculerAssurance(31)).toEqual({
      jours: 31,
      tarifApplique: 6.5,
      montantTotal: 201.5,
    });
    expect(calculerAssurance(40)).toEqual({
      jours: 40,
      tarifApplique: 6.5,
      montantTotal: 260,
    });
  });
});
