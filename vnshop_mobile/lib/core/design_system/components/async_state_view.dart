import 'package:flutter/material.dart';

enum AsyncViewStatus { loading, error, empty, ready }

AsyncViewStatus resolveAsyncViewStatus({
  required bool isLoading,
  required bool hasError,
  required bool isEmpty,
  required bool hasData,
}) {
  if (hasData) return AsyncViewStatus.ready;
  if (isLoading) return AsyncViewStatus.loading;
  if (hasError) return AsyncViewStatus.error;
  if (isEmpty) return AsyncViewStatus.empty;
  return AsyncViewStatus.ready;
}

class AsyncStateView extends StatelessWidget {
  const AsyncStateView({
    required this.status,
    required this.loading,
    required this.error,
    required this.empty,
    required this.child,
    this.retryLabel,
    this.onRetry,
    super.key,
  });

  final AsyncViewStatus status;
  final Widget loading;
  final Widget error;
  final Widget empty;
  final Widget child;
  final String? retryLabel;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return switch (status) {
      AsyncViewStatus.loading => Semantics(liveRegion: true, child: loading),
      AsyncViewStatus.error => Semantics(
        liveRegion: true,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            error,
            if (onRetry != null && retryLabel != null) ...[
              const SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh),
                label: Text(retryLabel!),
              ),
            ],
          ],
        ),
      ),
      AsyncViewStatus.empty => Semantics(liveRegion: true, child: empty),
      AsyncViewStatus.ready => child,
    };
  }
}
