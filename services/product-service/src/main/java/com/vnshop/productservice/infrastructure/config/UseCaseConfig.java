package com.vnshop.productservice.infrastructure.config;

import com.vnshop.productservice.application.CountSellerProductsUseCase;
import com.vnshop.productservice.application.CreateProductUseCase;
import com.vnshop.productservice.application.DeleteProductUseCase;
import com.vnshop.productservice.application.GetProductUseCase;
import com.vnshop.productservice.application.CatalogCursorCodec;
import com.vnshop.productservice.application.GetCategoriesUseCase;
import com.vnshop.productservice.application.UpdateProductUseCase;
import com.vnshop.productservice.application.UpdateProductEligibilityUseCase;
import com.vnshop.productservice.application.PublishProductUseCase;
import com.vnshop.productservice.application.image.ProductImageUploadService;
import com.vnshop.productservice.application.review.AnswerQuestionUseCase;
import com.vnshop.productservice.application.review.AdminReviewListUseCase;
import com.vnshop.productservice.application.review.AskQuestionUseCase;
import com.vnshop.productservice.application.review.CreateReviewUseCase;
import com.vnshop.productservice.application.review.GetProductReviewsUseCase;
import com.vnshop.productservice.application.review.GetQuestionsUseCase;
import com.vnshop.productservice.application.review.ModerateReviewUseCase;
import com.vnshop.productservice.application.review.ProductRatingProjectionService;
import com.vnshop.productservice.application.review.SellerReviewSummaryUseCase;
import com.vnshop.productservice.application.review.SellerReviewListUseCase;
import com.vnshop.productservice.application.review.VoteHelpfulUseCase;
import com.vnshop.productservice.application.review.image.ReviewImageUploadService;
import com.vnshop.productservice.application.storage.ObjectValidationPolicy;
import com.vnshop.productservice.application.storage.ObjectValidationService;
import com.vnshop.productservice.application.video.LocalStagingStore;
import com.vnshop.productservice.application.video.VideoAdminService;
import com.vnshop.productservice.application.video.VideoRedisPort;
import com.vnshop.productservice.application.video.VideoUploadService;
import com.vnshop.productservice.domain.port.out.ObjectMetadataRepositoryPort;
import com.vnshop.productservice.domain.port.out.ObjectStoragePort;
import com.vnshop.productservice.domain.port.out.ContentSanitizerPort;
import com.vnshop.productservice.domain.port.out.ProductEventOutboxPort;
import com.vnshop.productservice.domain.port.out.ProductRepositoryPort;
import com.vnshop.productservice.domain.review.port.out.BuyerProfileLookupPort;
import com.vnshop.productservice.domain.review.port.out.PurchaseVerificationPort;
import com.vnshop.productservice.domain.review.port.out.ReviewModerationPort;
import com.vnshop.productservice.domain.review.port.out.ReviewRepositoryPort;
import com.vnshop.productservice.domain.review.port.out.ProductRatingReadPort;
import com.vnshop.productservice.domain.port.out.CategoryRepositoryPort;
import com.vnshop.productservice.domain.storage.ObjectStorageClass;
import com.vnshop.productservice.domain.ProductTagNormalizer;
import com.vnshop.productservice.domain.video.port.out.VideoEventPublisherPort;
import com.vnshop.productservice.domain.video.port.out.VideoRepositoryPort;
import com.vnshop.productservice.infrastructure.persistence.video.VideoJpaRepository;
import com.vnshop.productservice.infrastructure.sanitization.HtmlSanitizer;
import com.vnshop.productservice.infrastructure.storage.VideoStorageProperties;
import java.util.Set;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.data.redis.core.StringRedisTemplate;

@Configuration
@EnableConfigurationProperties({ProductCursorProperties.class, ProductTagProperties.class, VideoStorageProperties.class})
public class UseCaseConfig {
    @Bean
    ProductTagNormalizer productTagNormalizer(ProductTagProperties properties) {
        return new ProductTagNormalizer(properties.toPolicy());
    }

    @Bean
    CreateProductUseCase createProductUseCase(ProductRepositoryPort productRepositoryPort,
            ProductEventOutboxPort productEventOutboxPort, ContentSanitizerPort contentSanitizer) {
        return new CreateProductUseCase(productRepositoryPort, productEventOutboxPort, contentSanitizer);
    }

    @Bean
    UpdateProductUseCase updateProductUseCase(ProductRepositoryPort productRepositoryPort,
            ProductEventOutboxPort productEventOutboxPort, HtmlSanitizer htmlSanitizer) {
        return new UpdateProductUseCase(productRepositoryPort, productEventOutboxPort, htmlSanitizer);
    }

    @Bean
    UpdateProductEligibilityUseCase updateProductEligibilityUseCase(
            ProductRepositoryPort productRepositoryPort,
            ProductEventOutboxPort productEventOutboxPort) {
        return new UpdateProductEligibilityUseCase(productRepositoryPort, productEventOutboxPort);
    }

    @Bean
    PublishProductUseCase publishProductUseCase(ProductRepositoryPort productRepositoryPort,
            ProductEventOutboxPort productEventOutboxPort) {
        return new PublishProductUseCase(productRepositoryPort, productEventOutboxPort);
    }

    @Bean
    DeleteProductUseCase deleteProductUseCase(ProductRepositoryPort productRepositoryPort,
            ProductEventOutboxPort productEventOutboxPort) {
        return new DeleteProductUseCase(productRepositoryPort, productEventOutboxPort);
    }

    @Bean
    GetProductUseCase getProductUseCase(
            ProductRepositoryPort productRepositoryPort,
            ProductRatingReadPort productRatingReadPort,
            ProductCursorProperties properties) {
        return new GetProductUseCase(productRepositoryPort, productRatingReadPort,
                new CatalogCursorCodec(properties.secret()));
    }

    @Bean
    GetCategoriesUseCase getCategoriesUseCase(CategoryRepositoryPort categoryRepositoryPort) {
        return new GetCategoriesUseCase(categoryRepositoryPort);
    }

    @Bean
    CountSellerProductsUseCase countSellerProductsUseCase(ProductRepositoryPort productRepositoryPort) {
        return new CountSellerProductsUseCase(productRepositoryPort);
    }

    @Bean
    ObjectValidationService productImageObjectValidationService() {
        return new ObjectValidationService(ObjectValidationPolicy.builder()
                .storageClass(ObjectStorageClass.PRODUCT_IMAGE)
                .maxBytes(5 * 1024 * 1024)
                .allowedContentTypes(Set.of("image/jpeg", "image/png", "image/webp"))
                .maxImageWidth(4096)
                .maxImageHeight(4096)
                .build());
    }

    @Bean
    ProductImageUploadService productImageUploadService(ProductRepositoryPort productRepositoryPort,
            ObjectStoragePort objectStoragePort, ObjectMetadataRepositoryPort objectMetadataRepositoryPort,
            ObjectValidationService productImageObjectValidationService) {
        return new ProductImageUploadService(productRepositoryPort, objectStoragePort, objectMetadataRepositoryPort,
                productImageObjectValidationService);
    }

    @Bean
    ProductRatingProjectionService productRatingProjectionService(
            ProductRepositoryPort productRepositoryPort,
            ProductEventOutboxPort productEventOutboxPort,
            ReviewRepositoryPort reviewRepositoryPort) {
        return new ProductRatingProjectionService(productRepositoryPort, productEventOutboxPort, reviewRepositoryPort);
    }

    @Bean
    CreateReviewUseCase createReviewUseCase(
            ReviewRepositoryPort reviewRepositoryPort,
            ContentSanitizerPort contentSanitizer,
            PurchaseVerificationPort purchaseVerificationPort,
            ReviewModerationPort reviewModerationPort,
            ProductRatingProjectionService productRatingProjectionService) {
        return new CreateReviewUseCase(
                reviewRepositoryPort,
                contentSanitizer,
                purchaseVerificationPort,
                reviewModerationPort,
                productRatingProjectionService);
    }

    @Bean
    GetProductReviewsUseCase getProductReviewsUseCase(ReviewRepositoryPort reviewRepositoryPort,
            BuyerProfileLookupPort buyerProfileLookupPort) {
        return new GetProductReviewsUseCase(reviewRepositoryPort, buyerProfileLookupPort);
    }

    @Bean
    ModerateReviewUseCase moderateReviewUseCase(ReviewRepositoryPort reviewRepositoryPort,
            ProductRatingProjectionService productRatingProjectionService) {
        return new ModerateReviewUseCase(reviewRepositoryPort, productRatingProjectionService);
    }

    @Bean
    AdminReviewListUseCase adminReviewListUseCase(
            ReviewRepositoryPort reviewRepositoryPort,
            BuyerProfileLookupPort buyerProfileLookupPort,
            ProductRepositoryPort productRepositoryPort) {
        return new AdminReviewListUseCase(reviewRepositoryPort, buyerProfileLookupPort, productRepositoryPort);
    }

    @Bean
    VoteHelpfulUseCase voteHelpfulUseCase(ReviewRepositoryPort reviewRepositoryPort) {
        return new VoteHelpfulUseCase(reviewRepositoryPort);
    }

    @Bean
    AskQuestionUseCase askQuestionUseCase(ReviewRepositoryPort reviewRepositoryPort) {
        return new AskQuestionUseCase(reviewRepositoryPort);
    }

    @Bean
    AnswerQuestionUseCase answerQuestionUseCase(ReviewRepositoryPort reviewRepositoryPort,
            ProductRepositoryPort productRepositoryPort) {
        return new AnswerQuestionUseCase(reviewRepositoryPort, productRepositoryPort);
    }

    @Bean
    GetQuestionsUseCase getQuestionsUseCase(ReviewRepositoryPort reviewRepositoryPort) {
        return new GetQuestionsUseCase(reviewRepositoryPort);
    }

    @Bean
    SellerReviewSummaryUseCase sellerReviewSummaryUseCase(ReviewRepositoryPort reviewRepositoryPort) {
        return new SellerReviewSummaryUseCase(reviewRepositoryPort);
    }

    @Bean
    SellerReviewListUseCase sellerReviewListUseCase(
            ReviewRepositoryPort reviewRepositoryPort,
            BuyerProfileLookupPort buyerProfileLookupPort,
            ProductRepositoryPort productRepositoryPort) {
        return new SellerReviewListUseCase(reviewRepositoryPort, buyerProfileLookupPort, productRepositoryPort);
    }

    @Bean
    ObjectValidationService reviewImageObjectValidationService() {
        return new ObjectValidationService(ObjectValidationPolicy.builder()
                .storageClass(ObjectStorageClass.REVIEW_IMAGE)
                .maxBytes(5 * 1024 * 1024)
                .allowedContentTypes(Set.of("image/jpeg", "image/png", "image/webp"))
                .maxImageWidth(4096)
                .maxImageHeight(4096)
                .build());
    }

    @Bean
    ReviewImageUploadService reviewImageUploadService(ReviewRepositoryPort reviewRepositoryPort,
            ObjectStoragePort objectStoragePort, ObjectMetadataRepositoryPort objectMetadataRepositoryPort,
            ObjectValidationService reviewImageObjectValidationService) {
        return new ReviewImageUploadService(reviewRepositoryPort, objectStoragePort, objectMetadataRepositoryPort,
                reviewImageObjectValidationService);
    }

    @Bean
    VideoAdminService videoAdminService(VideoRepositoryPort videoRepositoryPort,
            ObjectStoragePort objectStoragePort,
            VideoEventPublisherPort videoEventPublisherPort,
            VideoStorageProperties properties) {
        return new VideoAdminService(videoRepositoryPort, objectStoragePort,
                videoEventPublisherPort, properties.publicBucket());
    }

    @Bean
    VideoUploadService videoUploadService(VideoJpaRepository videoJpaRepository,
            LocalStagingStore localStagingStore,
            VideoEventPublisherPort videoEventPublisherPort,
            VideoRedisPort videoRedis,
            VideoStorageProperties properties) {
        return new VideoUploadService(videoJpaRepository, localStagingStore, videoEventPublisherPort, videoRedis,
                properties);
    }
}
