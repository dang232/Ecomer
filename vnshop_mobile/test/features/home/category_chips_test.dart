import 'dart:ui' show SemanticsAction, Tristate;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vnshop_mobile/features/home/presentation/widgets/category_chips.dart';

void main() {
  testWidgets('announces the selected category and supports selection', (
    tester,
  ) async {
    final selected = <int>[];
    final semantics = tester.ensureSemantics();

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: CategoryChips(
            categories: const [
              CategoryChipData(id: '', name: 'All'),
              CategoryChipData(id: 'audio', name: 'Audio'),
            ],
            selectedIndex: 1,
            onCategorySelected: selected.add,
          ),
        ),
      ),
    );

    final audioSemantics = tester.getSemantics(find.text('Audio'));
    final flags = audioSemantics.flagsCollection;
    expect(audioSemantics.label, 'Audio');
    expect(flags.isButton, isTrue);
    expect(flags.isEnabled, Tristate.isTrue);
    expect(flags.isSelected, Tristate.isTrue);
    expect(
      audioSemantics.getSemanticsData().hasAction(SemanticsAction.tap),
      isTrue,
    );

    await tester.tap(find.text('All'));
    expect(selected, [0]);
    semantics.dispose();
  });
}
