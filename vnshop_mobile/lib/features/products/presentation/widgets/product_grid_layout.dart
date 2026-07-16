import 'dart:math' as math;

import 'package:flutter/material.dart';

SliverGridDelegate productGridDelegate(
  BuildContext context, {
  double horizontalPadding = 32,
}) {
  final width = MediaQuery.sizeOf(context).width - horizontalPadding;
  final textScale = MediaQuery.textScalerOf(context).scale(14) / 14;
  final largeText = textScale > 1.3;
  final targetCardWidth = largeText ? 320.0 : (width >= 720 ? 220.0 : 168.0);
  final columns = math.max(1, math.min(4, (width / targetCardWidth).floor()));

  return SliverGridDelegateWithFixedCrossAxisCount(
    crossAxisCount: columns,
    mainAxisExtent: largeText ? 500 : 300,
    crossAxisSpacing: 12,
    mainAxisSpacing: 12,
  );
}
