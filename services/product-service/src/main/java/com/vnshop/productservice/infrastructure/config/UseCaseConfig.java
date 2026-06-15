package com.vnshop.productservice.infrastructure.config;

import com.vnshop.productservice.application.CountSellerProductsUseCase;
import com.vnshop.productservice.application.CreateProductUseCase;
import com.vnshop.productservice.application.DeleteProductUseCase;
import com.vnshop.productservice.application.GetProductUseCase;
import com.vnshop.productservice.application.UpdateProductUseCase;
import com.vnshop.productservice.application.image.ProductImageUploadService;
import com.vnshop.productservice.application.review.AnswerQuestionUseCase;
import com.vnshop.productservice.application.review.AskQuestionUseCase;
import com.vnshop.productservice.application.review.CreateReviewUseCase;
import com.vnshop.productservice.application.review.GetProductReviewsUseCase;
import com.vnshop.productservice.application.review.GetQuestionsUseCase;
import com.vnshop.productservice.application.review.ModerateReviewUseCase;
import com.vnshop.productservice.application.review.SellerReviewSummaryUseCase;
import com.vnshop.productservice.application.review.VoteHelpfulUseCase;
import com.vnshop.productservice.application.review.image.ReviewImageUploadService;
import com.vnshop.productservice.application.storage.ObjectValidationPolicy;
import com.vnshop.productservice.application.storage.ObjectValidationService;
import com.vnshop.productservice.application.video.LocalStagingStore;
import com.vnshop.productservice.application.video.VideoAdminService;
import com.vnshop.productservice.application.video.VideoUploadService;
import com.vnshop.productservice.domain.port.out.ObjectMetadataRepositoryPort;
import com.vnshop.productservice.domain.port.out.ObjectStoragePort;
import com.vnshop.productservice.domain.port.out.ProductEventPublisherPort;
import com.vnshop.productservice.domain.port.out.ProductRepositoryPort;
import com.vnshop.productservice.domain.review.port.out.BuyerProfileLookupPort;
import com.vnshop.productservice.domain.review.port.out.ReviewRepositoryPort;
import com.vnshop.productservice.domain.storage.ObjectStorageClass;
import com.vnshop.productservice.domain.video.port.out.VideoEventPublisherPort;
import com.vnshop.productservice.domain.video.port.out.VideoRepositoryPort;
import com.vnshop.productservice.infrastructure.persistence.video.VideoJpaRepository;
import com.vnshop.productservice.infrastructure.sanitization.HtmlSanitizer;
import java.util.Set;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.StringRedisTemplate;

@Configuration
public class UseCaseConfig {
    @Bean
    CreateProductUseCase createProductUseCase(ProductRepositoryPort productRepositoryPort,
            ProductEventPublisherPort productEventPublisherPort, HtmlSanitizer htmlSanitizer) {
        return new CreateProductUseCase(productRepositoryPort, productEventPublisherPort, htmlSanitizer);
    }

    @Bean
    UpdateProductUseCase updateProductUseCase(ProductRepositoryPort productRepositoryPort,
            ProductEventPublisherPort productEventPublisherPort, HtmlSanitizer htmlSanitizer) {
        return new UpdateProductUseCase(productRepositoryPort, productEventPublisherPort, htmlSanitizer);
    }

    @Bean
    DeleteProductUseCase deleteProductUseCase(ProductRepositoryPort productRepositoryPort,
            ProductEventPublisherPort productEventPublisherPort) {
        return new DeleteProductUseCase(productRepositoryPort, productEventPublisherPort);
    }

    @Bean
    GetProductUseCase getProductUseCase(ProductRepositoryPort productRepositoryPort) {
        return new GetProductUseCase(productRepositoryPort);
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
    CreateReviewUseCase createReviewUseCase(ReviewRepositoryPort reviewRepositoryPort, HtmlSanitizer htmlSanitizer) {
        return new CreateReviewUseCase(reviewRepositoryPort, htmlSanitizer);
    }

    @Bean
    GetProductReviewsUseCase getProductReviewsUseCase(ReviewRepositoryPort reviewRepositoryPort,
            BuyerProfileLookupPort buyerProfileLookupPort) {
        return new GetProductReviewsUseCase(reviewRepositoryPort, buyerProfileLookupPort);
    }

    @Bean
    ModerateReviewUseCase moderateReviewUseCase(ReviewRepositoryPort reviewRepositoryPort) {
        return new ModerateReviewUseCase(reviewRepositoryPort);
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
            VideoEventPublisherPort videoEventPublisherPort) {
        return new VideoAdminService(videoRepositoryPort, objectStoragePort, videoEventPublisherPort);
    }

    @Bean
    VideoUploadService videoUploadService(VideoJpaRepository videoJpaRepository,
            LocalStagingStore localStagingStore,
            VideoEventPublisherPort videoEventPublisherPort,
            StringRedisTemplate stringRedisTemplate) {
        return new VideoUploadService(videoJpaRepository, localStagingStore, videoEventPublisherPort, stringRedisTemplate);
    }
}
