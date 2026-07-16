import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

import '../../../../core/design_system/components/async_state_view.dart';
import '../../../../core/design_system/generated/design_tokens.dart';
import '../../../../l10n/generated/app_localizations.dart';
import '../../domain/entities/review.dart';
import '../../domain/entities/review_summary.dart';
import '../bloc/review_cubit.dart';
import '../bloc/review_state.dart';

class ProductReviewsSection extends StatelessWidget {
  const ProductReviewsSection({
    required this.isAuthenticated,
    required this.onLogin,
    super.key,
  });

  final bool isAuthenticated;
  final VoidCallback onLogin;

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    return BlocConsumer<ReviewCubit, ReviewState>(
      listenWhen: (previous, current) =>
          current.action != null && previous.action != current.action,
      listener: (context, state) {
        final message = switch (state.action) {
          ReviewAction.published => localizations.reviewPublishedNotice,
          ReviewAction.pending => localizations.reviewPendingNotice,
          ReviewAction.rejected => localizations.reviewRejectedNotice,
          ReviewAction.submitFailed => localizations.reviewSubmitError,
          ReviewAction.voteFailed => localizations.reviewVoteError,
          null => null,
        };
        if (message == null) return;
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(content: Text(message)));
      },
      builder: (context, state) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              localizations.customerReviews,
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: DesignSize.spaceXs),
            Text(
              localizations.reviewSectionSubtitle,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
            if (state.summary.count > 0) ...[
              const SizedBox(height: DesignSize.spaceLg),
              _ReviewSummaryCard(summary: state.summary),
            ],
            const SizedBox(height: DesignSize.spaceLg),
            if (isAuthenticated)
              _ReviewComposer(state: state)
            else
              _SignInPrompt(onLogin: onLogin),
            if (state.submission != null &&
                state.submissionOutcome != null) ...[
              const SizedBox(height: DesignSize.spaceMd),
              _SubmissionNotice(
                review: state.submission!,
                outcome: state.submissionOutcome!,
              ),
            ],
            const SizedBox(height: DesignSize.spaceLg),
            _ReviewList(state: state),
          ],
        );
      },
    );
  }
}

class _ReviewSummaryCard extends StatelessWidget {
  const _ReviewSummaryCard({required this.summary});

  final ReviewSummary summary;

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final score = Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Text(
          summary.average.toStringAsFixed(1),
          style: Theme.of(
            context,
          ).textTheme.headlineLarge?.copyWith(fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: DesignSize.spaceXs),
        _RatingStars(value: summary.average),
        const SizedBox(height: DesignSize.spaceXs),
        Text(
          localizations.reviewCount(summary.count),
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
        ),
      ],
    );

    final distribution = Column(
      children: [
        for (var rating = 5; rating >= 1; rating--)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 3),
            child: _RatingDistributionRow(
              rating: rating,
              count: summary.distribution[rating] ?? 0,
              total: summary.count,
            ),
          ),
      ],
    );

    return _ReviewSurface(
      child: LayoutBuilder(
        builder: (context, constraints) {
          if (constraints.maxWidth >= 520) {
            return Row(
              children: [
                SizedBox(width: 144, child: score),
                const SizedBox(width: DesignSize.spaceXl),
                Expanded(child: distribution),
              ],
            );
          }
          return Column(
            children: [
              score,
              const SizedBox(height: DesignSize.spaceLg),
              distribution,
            ],
          );
        },
      ),
    );
  }
}

class _RatingDistributionRow extends StatelessWidget {
  const _RatingDistributionRow({
    required this.rating,
    required this.count,
    required this.total,
  });

  final int rating;
  final int count;
  final int total;

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final percentage = total == 0 ? 0.0 : count / total;
    return Row(
      children: [
        SizedBox(
          width: 24,
          child: Text('$rating', style: Theme.of(context).textTheme.bodySmall),
        ),
        Expanded(
          child: Semantics(
            label: localizations.reviewRatingBreakdown(rating),
            value: '${(percentage * 100).round()}%',
            child: ClipRRect(
              borderRadius: BorderRadius.circular(DesignSize.radiusRound),
              child: LinearProgressIndicator(
                value: percentage,
                minHeight: 8,
                backgroundColor: Theme.of(
                  context,
                ).colorScheme.surfaceContainerHighest,
              ),
            ),
          ),
        ),
        const SizedBox(width: DesignSize.spaceSm),
        SizedBox(
          width: 40,
          child: Text(
            '${(percentage * 100).round()}%',
            textAlign: TextAlign.end,
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ),
      ],
    );
  }
}

class _ReviewComposer extends StatefulWidget {
  const _ReviewComposer({required this.state});

  final ReviewState state;

  @override
  State<_ReviewComposer> createState() => _ReviewComposerState();
}

class _ReviewComposerState extends State<_ReviewComposer> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.state.comment);
  }

  @override
  void didUpdateWidget(_ReviewComposer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.state.comment != _controller.text) {
      _controller.value = TextEditingValue(
        text: widget.state.comment,
        selection: TextSelection.collapsed(offset: widget.state.comment.length),
      );
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    return _ReviewSurface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            localizations.yourReview,
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: DesignSize.spaceSm),
          Wrap(
            spacing: DesignSize.spaceXs,
            children: [
              for (var rating = 1; rating <= 5; rating++)
                Semantics(
                  label: localizations.reviewRatingOption(rating),
                  button: true,
                  selected: widget.state.rating == rating,
                  excludeSemantics: true,
                  child: IconButton(
                    isSelected: widget.state.rating == rating,
                    constraints: const BoxConstraints(
                      minWidth: DesignSize.targetMobile,
                      minHeight: DesignSize.targetMobile,
                    ),
                    onPressed: widget.state.isSubmitting
                        ? null
                        : () => context.read<ReviewCubit>().setRating(rating),
                    icon: Icon(
                      rating <= widget.state.rating
                          ? Icons.star_rounded
                          : Icons.star_border_rounded,
                      color: Theme.of(context).colorScheme.tertiary,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: DesignSize.spaceSm),
          TextFormField(
            controller: _controller,
            minLines: 3,
            maxLines: 6,
            maxLength: 2000,
            enabled: !widget.state.isSubmitting,
            decoration: InputDecoration(
              labelText: localizations.yourReview,
              hintText: localizations.shareReviewExperience,
              alignLabelWithHint: true,
            ),
            onChanged: context.read<ReviewCubit>().setComment,
          ),
          const SizedBox(height: DesignSize.spaceSm),
          FilledButton.icon(
            onPressed: widget.state.canSubmit
                ? () => context.read<ReviewCubit>().submit()
                : null,
            icon: widget.state.isSubmitting
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.rate_review_outlined),
            label: Text(
              widget.state.isSubmitting
                  ? localizations.submittingReview
                  : localizations.submitReview,
            ),
          ),
        ],
      ),
    );
  }
}

class _SignInPrompt extends StatelessWidget {
  const _SignInPrompt({required this.onLogin});

  final VoidCallback onLogin;

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border.symmetric(
          horizontal: BorderSide(
            color: Theme.of(context).colorScheme.outlineVariant,
          ),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: DesignSize.spaceMd),
        child: Wrap(
          alignment: WrapAlignment.spaceBetween,
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: DesignSize.spaceMd,
          runSpacing: DesignSize.spaceSm,
          children: [
            Text(localizations.signInToReview),
            OutlinedButton.icon(
              onPressed: onLogin,
              icon: const Icon(Icons.login),
              label: Text(localizations.signIn),
            ),
          ],
        ),
      ),
    );
  }
}

class _SubmissionNotice extends StatelessWidget {
  const _SubmissionNotice({required this.review, required this.outcome});

  final Review review;
  final ReviewPublicationOutcome outcome;

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final (label, icon, color) = switch (outcome) {
      ReviewPublicationOutcome.published => (
        localizations.reviewPublished,
        Icons.check_circle_outline,
        Theme.of(context).colorScheme.primary,
      ),
      ReviewPublicationOutcome.pending => (
        localizations.reviewPending,
        Icons.schedule_outlined,
        Theme.of(context).colorScheme.tertiary,
      ),
      ReviewPublicationOutcome.rejected => (
        localizations.reviewRejected,
        Icons.error_outline,
        Theme.of(context).colorScheme.error,
      ),
    };

    return Semantics(
      liveRegion: true,
      child: _ReviewSurface(
        backgroundColor: color.withValues(alpha: 0.08),
        borderColor: color.withValues(alpha: 0.45),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: color, size: 20),
                const SizedBox(width: DesignSize.spaceSm),
                Expanded(
                  child: Text(
                    label,
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: color,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
            if (outcome != ReviewPublicationOutcome.published &&
                review.comment?.isNotEmpty == true) ...[
              const SizedBox(height: DesignSize.spaceSm),
              Text(review.comment!),
            ],
          ],
        ),
      ),
    );
  }
}

class _ReviewList extends StatelessWidget {
  const _ReviewList({required this.state});

  final ReviewState state;

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final status = switch (state.status) {
      ReviewViewStatus.initial ||
      ReviewViewStatus.loading => AsyncViewStatus.loading,
      ReviewViewStatus.failure => AsyncViewStatus.error,
      ReviewViewStatus.empty => AsyncViewStatus.empty,
      ReviewViewStatus.ready => AsyncViewStatus.ready,
    };

    return AsyncStateView(
      status: status,
      loading: const _ReviewListSkeleton(),
      error: _SectionMessage(
        icon: Icons.cloud_off_outlined,
        title: localizations.reviewsLoadError,
        message: localizations.reviewsLoadErrorHelp,
      ),
      empty: _SectionMessage(
        icon: Icons.rate_review_outlined,
        title: localizations.noReviewsTitle,
        message: localizations.noReviewsSubtitle,
      ),
      retryLabel: localizations.tryAgain,
      onRetry: context.read<ReviewCubit>().load,
      child: Column(
        children: [
          for (var index = 0; index < state.reviews.length; index++) ...[
            _ReviewCard(
              review: state.reviews[index],
              isVoting: state.votingReviewId == state.reviews[index].id,
            ),
            if (index < state.reviews.length - 1)
              const SizedBox(height: DesignSize.spaceMd),
          ],
        ],
      ),
    );
  }
}

class _ReviewCard extends StatelessWidget {
  const _ReviewCard({required this.review, required this.isVoting});

  final Review review;
  final bool isVoting;

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context).toLanguageTag();
    final name = review.userName ?? localizations.anonymousCustomer;
    final date = review.createdAt == null
        ? null
        : DateFormat.yMMMd(locale).format(review.createdAt!.toLocal());

    return _ReviewSurface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 20,
                foregroundImage: review.userAvatarUrl == null
                    ? null
                    : NetworkImage(review.userAvatarUrl!),
                child: review.userAvatarUrl == null
                    ? Text(
                        name.isEmpty
                            ? '?'
                            : name.characters.first.toUpperCase(),
                      )
                    : null,
              ),
              const SizedBox(width: DesignSize.spaceMd),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: DesignSize.spaceSm,
                      runSpacing: DesignSize.spaceXs,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(
                          name,
                          style: Theme.of(context).textTheme.titleSmall
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                        if (review.verifiedPurchase)
                          _VerifiedPurchaseLabel(
                            label: localizations.verifiedPurchase,
                          ),
                      ],
                    ),
                    const SizedBox(height: DesignSize.spaceXs),
                    Wrap(
                      spacing: DesignSize.spaceSm,
                      runSpacing: DesignSize.spaceXs,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Semantics(
                          label: localizations.reviewRatingOption(
                            review.rating,
                          ),
                          child: _RatingStars(
                            value: review.rating.toDouble(),
                            size: 16,
                          ),
                        ),
                        if (date != null)
                          Text(
                            date,
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(
                                  color: Theme.of(
                                    context,
                                  ).colorScheme.onSurfaceVariant,
                                ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (review.comment?.isNotEmpty == true) ...[
            const SizedBox(height: DesignSize.spaceMd),
            Text(review.comment!),
          ],
          if (review.images.isNotEmpty) ...[
            const SizedBox(height: DesignSize.spaceMd),
            Wrap(
              spacing: DesignSize.spaceSm,
              runSpacing: DesignSize.spaceSm,
              children: [
                for (var index = 0; index < review.images.length; index++)
                  Semantics(
                    label: localizations.reviewImageLabel(index + 1),
                    image: true,
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(
                        DesignSize.radiusControl,
                      ),
                      child: Image.network(
                        review.images[index],
                        width: 72,
                        height: 72,
                        fit: BoxFit.cover,
                        errorBuilder: (context, error, stackTrace) => Container(
                          width: 72,
                          height: 72,
                          color: Theme.of(
                            context,
                          ).colorScheme.surfaceContainerHighest,
                          alignment: Alignment.center,
                          child: const Icon(Icons.broken_image_outlined),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ],
          const SizedBox(height: DesignSize.spaceXs),
          TextButton.icon(
            onPressed: isVoting
                ? null
                : () => context.read<ReviewCubit>().voteHelpful(review.id),
            icon: isVoting
                ? const SizedBox.square(
                    dimension: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.thumb_up_alt_outlined, size: 18),
            label: Text(
              isVoting
                  ? localizations.saving
                  : localizations.helpfulCount(review.helpfulVotes),
            ),
          ),
        ],
      ),
    );
  }
}

class _VerifiedPurchaseLabel extends StatelessWidget {
  const _VerifiedPurchaseLabel({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.primaryContainer,
        borderRadius: BorderRadius.circular(DesignSize.radiusRound),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.verified_outlined, size: 14),
            const SizedBox(width: DesignSize.spaceXs),
            Text(label, style: Theme.of(context).textTheme.labelSmall),
          ],
        ),
      ),
    );
  }
}

class _RatingStars extends StatelessWidget {
  const _RatingStars({required this.value, this.size = 18});

  final double value;
  final double size;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var rating = 1; rating <= 5; rating++)
            Icon(
              rating <= value.round()
                  ? Icons.star_rounded
                  : Icons.star_border_rounded,
              size: size,
              color: Theme.of(context).colorScheme.tertiary,
            ),
        ],
      ),
    );
  }
}

class _ReviewSurface extends StatelessWidget {
  const _ReviewSurface({
    required this.child,
    this.backgroundColor,
    this.borderColor,
  });

  final Widget child;
  final Color? backgroundColor;
  final Color? borderColor;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: backgroundColor ?? Theme.of(context).colorScheme.surface,
        border: Border.all(
          color: borderColor ?? Theme.of(context).colorScheme.outlineVariant,
        ),
        borderRadius: BorderRadius.circular(DesignSize.radiusCard),
      ),
      child: Padding(
        padding: const EdgeInsets.all(DesignSize.spaceLg),
        child: child,
      ),
    );
  }
}

class _SectionMessage extends StatelessWidget {
  const _SectionMessage({
    required this.icon,
    required this.title,
    required this.message,
  });

  final IconData icon;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: DesignSize.spaceXl),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 40,
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
          const SizedBox(height: DesignSize.spaceMd),
          Text(
            title,
            textAlign: TextAlign.center,
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: DesignSize.spaceSm),
          Text(
            message,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}

class _ReviewListSkeleton extends StatelessWidget {
  const _ReviewListSkeleton();

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.surfaceContainerHighest;
    return Semantics(
      liveRegion: true,
      child: Column(
        children: [
          for (var item = 0; item < 2; item++) ...[
            _ReviewSurface(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      CircleAvatar(backgroundColor: color),
                      const SizedBox(width: DesignSize.spaceMd),
                      Expanded(child: Container(height: 18, color: color)),
                    ],
                  ),
                  const SizedBox(height: DesignSize.spaceMd),
                  Container(height: 14, color: color),
                  const SizedBox(height: DesignSize.spaceSm),
                  FractionallySizedBox(
                    widthFactor: 0.7,
                    child: Container(height: 14, color: color),
                  ),
                ],
              ),
            ),
            if (item == 0) const SizedBox(height: DesignSize.spaceMd),
          ],
        ],
      ),
    );
  }
}
