package com.vnshop.invoiceservice.infrastructure.dlt;

import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(HttpStatus.CONFLICT)
public class DurableDltReplayConflictException extends RuntimeException {
    public DurableDltReplayConflictException(UUID id) { super("DLT record has already been claimed or replayed: " + id); }
}
