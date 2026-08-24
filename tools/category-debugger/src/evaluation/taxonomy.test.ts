import { describe, expect, it } from 'vitest';
import { resolvePlacementZone } from './taxonomy';

describe('resolvePlacementZone', () => {
  it('gruppiert haltbare Milch, Pflanzendrinks und Kochsahne zusammen', () => {
    expect(resolvePlacementZone('milk', 'ambient')).toBe('ambient_milk_drinks');
    expect(resolvePlacementZone('plant_drink', 'ambient')).toBe('ambient_milk_drinks');
    expect(resolvePlacementZone('cream', 'ambient')).toBe('ambient_milk_drinks');
  });

  it('trennt gekühlte und haltbare Pflanzendrinks', () => {
    expect(resolvePlacementZone('plant_drink', 'chilled')).toBe('chilled_dairy_eggs');
    expect(resolvePlacementZone('plant_drink', 'ambient')).toBe('ambient_milk_drinks');
  });

  it('trennt Kokosdrink und konservierte Kochzutaten über Familie und Form', () => {
    expect(resolvePlacementZone('plant_drink', 'ambient')).toBe('ambient_milk_drinks');
    expect(resolvePlacementZone('canned_food', 'canned_jarred')).toBe('canned_jars');
  });

  it('hält die beobachteten Marktgruppen fachlich getrennt', () => {
    expect(resolvePlacementZone('pasta', 'dry')).toBe('pasta_tomato');
    expect(resolvePlacementZone('rice', 'dry')).toBe('rice_world_foods');
    expect(resolvePlacementZone('breakfast_cereal', 'dry')).toBe('breakfast');
    expect(resolvePlacementZone('condiments', 'ambient')).toBe('condiments');
    expect(resolvePlacementZone('coffee', 'dry')).toBe('hot_drinks');
    expect(resolvePlacementZone('water_soft_drinks', 'ambient')).toBe('cold_drinks');
  });

  it('lässt die Tiefkühlform die Produktfamilie überstimmen', () => {
    expect(resolvePlacementZone('fruit', 'frozen')).toBe('frozen');
    expect(resolvePlacementZone('pasta', 'frozen')).toBe('frozen');
  });
});
